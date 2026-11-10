#!/usr/bin/env python3
"""team-07 reasoning engine: fit an explainable driver model for daily overnight stays in Paznaun-Ischgl.

    log(stays + 1) = season calendar + weekday + Easter + Christmas/New Year + school holidays per market
                     + new snow + season level + e

Every driver is known before the day (calendar, holidays, season dates; snow ~16 days ahead), so the same model
explains past changes AND the forecast, and can state reasons for weeks that have not happened yet.
The n8n workflow "team-07 · Drop Watch & Investigate" uses the stored coefficients to split a change vs last year
into driver contributions (in stays) plus a residual: the reasons are exact parts of the model, not LLM guesses.

Usage (repository root):
    python3 scripts/fit_driver_model.py --dry-run     # fit + backtest, print the report, write nothing
    python3 scripts/fit_driver_model.py               # fit + backtest + write tables (team_07_driver_model, ...)

Needs psql and SUPABASE_DB_URL in .env.local (never printed). Standard library only (no numpy), ~730 rows x ~40
features, ridge least squares solved with Gaussian elimination; block bootstrap by week for confidence intervals.
"""
import argparse
import json
import math
import random
import statistics
import subprocess
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _env  # noqa: E402
VERSION = "drivers-v2"
HIST_FROM, HIST_TO = date(2024, 11, 4), date(2026, 10, 31)
MARKETS = ["DE", "NL", "BE", "CH", "UK", "AT"]
# number of regions per market in OpenHolidays (coverage = regions on holiday / regions); national rows count as 1.0
REGIONS = {"DE": 16, "CH": 26, "AT": 9, "NL": 12, "BE": 1, "UK": 1}
RIDGE = 1.0
N_BOOT = 120
random.seed(7)


# ---------------------------------------------------------------- database helpers
def db_url():
    return _env.require("SUPABASE_DB_URL")


def psql(sql, stdin=None):
    url = db_url()
    import os
    env = {**os.environ, "PGCONNECT_TIMEOUT": "15"}
    r = subprocess.run(["psql", url, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"] + (["-c", sql] if sql else []),
                       input=stdin, text=True, capture_output=True, timeout=300, env=env)
    if r.returncode:
        sys.exit("psql failed: " + r.stderr.replace(url, "<db>"))
    return r.stdout.strip()


def q_json(sql):
    out = psql(f"select coalesce(json_agg(t), '[]') from ({sql}) t")
    return json.loads(out)


def d(iso):
    return date.fromisoformat(iso)


def drange(a, b):
    x = a
    while x <= b:
        yield x
        x += timedelta(days=1)


def easter(y):
    a, b, c = y % 19, y // 100, y % 100
    dd, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - dd - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    return date(y, (h + l - 7 * m + 114) // 31, (h + l - 7 * m + 114) % 31 + 1)


# ---------------------------------------------------------------- load data
def load():
    stays = q_json("select s.date::text as date, s.previous_year, s.forecast, s.actual, m.quality_flag from team_07_stays_daily s "
                   "left join team_07_metrics_daily m on m.date = s.date")
    hol = q_json("select market, region, start_date::text, end_date::text, type from team_07_holidays where type like 'school:%'")
    wx = q_json("select date::text, snowfall_cm, temp_max from team_07_weather_daily where location = 'Ischgl'")
    return stays, hol, wx


def build_series(stays):
    """History 2024-11-04 -> 2026-10-31 (last-year column = actual on the same date a year earlier, then actuals),
    forecast 2025-11-04 -> 2027-04-04."""
    by = {d(r["date"]): r for r in stays}
    hist, fc, flag = {}, {}, {}
    for day, r in by.items():
        if r["forecast"] is not None:
            fc[day] = r["forecast"]
        if r["actual"] is not None:
            hist[day] = r["actual"]
            flag[day] = r["quality_flag"]
        if r["previous_year"] is not None:
            try:
                prev = day.replace(year=day.year - 1)
            except ValueError:  # 29 Feb
                continue
            if prev < date(2025, 11, 4) and prev >= HIST_FROM:
                hist.setdefault(prev, r["previous_year"])
    hist = {k: v for k, v in hist.items() if HIST_FROM <= k <= HIST_TO}
    return hist, fc, flag


def detect_seasons(series, end_known):
    """Winter season Nov-May, summer Jun-Oct: open = first day with stays >= 25 % of the season's 90th percentile."""
    out = []
    years = sorted({k.year for k in series})
    for y in years:
        for kind, a, b in (("winter", date(y, 11, 1), date(y + 1, 5, 31)), ("summer", date(y, 6, 1), date(y, 10, 31))):
            vals = [(k, v) for k, v in series.items() if a <= k <= b]
            if len(vals) < 40:
                continue
            p90 = sorted(v for _, v in vals)[int(len(vals) * 0.9)]
            thr = 0.25 * p90
            on = [k for k, v in sorted(vals) if v >= thr]
            if not on:
                continue
            open_d, close_d = on[0], on[-1]
            if close_d >= end_known - timedelta(days=2):  # still open at the end of the data: closing unknown
                close_d = None
            name = f"winter {y}/{str(y + 1)[2:]}" if kind == "winter" else f"summer {y}"
            out.append({"season": name, "kind": kind, "open": open_d, "close": close_d})
    return out


# ---------------------------------------------------------------- features
def holiday_coverage(hol):
    """market -> date -> share of the market's regions on school holiday (0..1)."""
    cov = {m: defaultdict(set) for m in MARKETS}
    for h in hol:
        m = h["market"]
        if m not in cov:
            continue
        regs = [x.strip() for x in (h["region"] or "").split(",") if x.strip()] or ["*"]
        for day in drange(d(h["start_date"]), d(h["end_date"])):
            for r in regs:
                cov[m][day].add(r)
    def share(m, day):
        s = cov[m].get(day)
        if not s:
            return 0.0
        if "*" in s:
            return 1.0
        return min(1.0, len(s) / REGIONS[m])
    return share


FEATURES = (
    ["const", "open", "summer", "open_d0_6", "open_d7_13", "close_d0_6", "close_d7_13"]
    # smooth position in the year (Fourier terms of the day of the year), separately for winter and summer:
    # a one-day calendar shift changes them only a little (month dummies jumped at month boundaries)
    + [f"{s}_{t}{k}" for s in ("w", "s") for k in (1, 2, 3) for t in ("sin", "cos")]
    + [f"wd_{w}" for w in ("mon", "tue", "wed", "thu", "fri", "sat")]
    + ["easter_m14_8", "easter_m7_1", "easter_0_1", "easter_p2_7", "easter_p8_14"]
    + ["xmas_24_26", "xmas_27_31", "newyear_1_6"]
    + [f"hol_{m}" for m in MARKETS]
    + ["snow7", "level_w2526", "level_s2026"]
)
# Easter, school holidays and Christmas are one "holiday calendar" driver: with two winters of data they cannot be
# separated reliably (Easter moves the school holidays), but their joint effect is well identified. Sub-parts are shown.
GROUPS = {f: ("base" if f == "const" else "season_calendar" if f in ("open", "summer") or f.startswith(("open_d", "close_d", "w_", "s_"))
              else "weekday" if f.startswith("wd_") else "calendar" if f.startswith(("easter", "xmas", "newyear", "hol_"))
              else "snow" if f == "snow7" else "level") for f in FEATURES}


def season_of(day, seasons):
    for s in seasons:
        end = s["close"] or date(2099, 1, 1)
        if s["open"] <= day <= end:
            return s
    return None


def features(day, seasons, hshare, snow):
    s = season_of(day, seasons)
    op = 1.0 if s else 0.0
    summer = 1.0 if s and s["kind"] == "summer" else 0.0
    winter = op * (1 - summer)
    x = dict.fromkeys(FEATURES, 0.0)
    x["const"] = 1.0
    x["open"] = op
    x["summer"] = summer
    if s:
        since = (day - s["open"]).days
        x["open_d0_6"] = 1.0 if since <= 6 else 0.0
        x["open_d7_13"] = 1.0 if 7 <= since <= 13 else 0.0
        if s["close"]:
            until = (s["close"] - day).days
            x["close_d0_6"] = 1.0 if until <= 6 else 0.0
            x["close_d7_13"] = 1.0 if 7 <= until <= 13 else 0.0
        t = 2 * math.pi * (day.timetuple().tm_yday / 365.25)
        pre = "s" if summer else "w"
        for k in (1, 2, 3):
            x[f"{pre}_sin{k}"] = round(math.sin(k * t), 4)
            x[f"{pre}_cos{k}"] = round(math.cos(k * t), 4)
        wd = ["mon", "tue", "wed", "thu", "fri", "sat", None][day.weekday()]
        if wd:
            x[f"wd_{wd}"] = 1.0
    if winter:
        rel = (day - easter(day.year)).days
        for name, lo, hi in (("easter_m14_8", -14, -8), ("easter_m7_1", -7, -1), ("easter_0_1", 0, 1), ("easter_p2_7", 2, 7), ("easter_p8_14", 8, 14)):
            if lo <= rel <= hi:
                x[name] = 1.0
        if day.month == 12 and 24 <= day.day <= 26:
            x["xmas_24_26"] = 1.0
        if day.month == 12 and day.day >= 27:
            x["xmas_27_31"] = 1.0
        if day.month == 1 and day.day <= 6:
            x["newyear_1_6"] = 1.0
        for m in MARKETS:
            x[f"hol_{m}"] = round(hshare(m, day), 3)
        s7 = [snow.get(day - timedelta(days=i)) for i in range(7)]
        s7 = [v for v in s7 if v is not None]
        x["snow7"] = round(min(sum(s7), 150) / 50, 3) if s7 else 0.0
    if s and s["season"] == "winter 2025/26":
        x["level_w2526"] = 1.0
    if s and s["season"] == "summer 2026":
        x["level_s2026"] = 1.0
    return [x[f] for f in FEATURES]


# ---------------------------------------------------------------- ridge least squares (pure Python)
def solve(A, b):
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        if abs(M[c][c]) < 1e-12:
            continue
        for r in range(n):
            if r != c and M[r][c]:
                f = M[r][c] / M[c][c]
                M[r] = [a - f * bb for a, bb in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] if abs(M[i][i]) > 1e-12 else 0.0 for i in range(n)]


def fit(X, y, w=None):
    p = len(X[0])
    w = w or [1.0] * len(X)
    A = [[0.0] * p for _ in range(p)]
    b = [0.0] * p
    for xi, yi, wi in zip(X, y, w):
        for j in range(p):
            if xi[j]:
                b[j] += wi * xi[j] * yi
                for k in range(p):
                    if xi[k]:
                        A[j][k] += wi * xi[j] * xi[k]
    for j in range(1, p):  # no penalty on the constant
        A[j][j] += RIDGE
    return solve(A, b)


def predict(beta, x):
    return sum(a * b for a, b in zip(beta, x))


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    stays, hol, wx = load()
    hist, fc, flag = build_series(stays)
    snow = {d(r["date"]): float(r["snowfall_cm"]) for r in wx if r["snowfall_cm"] is not None}
    seasons = detect_seasons({**hist, **{k: v for k, v in fc.items() if k > HIST_TO}}, max(fc))
    # the season that is still open in the forecast has no closing date: treat as open to the end of the data
    hshare = holiday_coverage(hol)
    print(f"History {min(hist)} -> {max(hist)}: {len(hist)} days; forecast {min(fc)} -> {max(fc)}: {len(fc)} days")
    print("Seasons detected:")
    for s in seasons:
        print(f"  {s['season']:16s} open {s['open']}  close {s['close'] or 'open at end of data'}")

    days = sorted(hist)
    X = [features(k, seasons, hshare, snow) for k in days]
    y = [math.log(hist[k] + 1) for k in days]
    beta = fit(X, y)
    resid = [yi - predict(beta, xi) for xi, yi in zip(X, y)]
    ss_res = sum(r * r for r in resid)
    ybar = statistics.mean(y)
    r2 = 1 - ss_res / sum((v - ybar) ** 2 for v in y)

    # block bootstrap by ISO week
    weeks = defaultdict(list)
    for i, k in enumerate(days):
        weeks[k.isocalendar()[:2]].append(i)
    wkeys = list(weeks)
    samples = []
    for _ in range(N_BOOT):
        idx = [i for _k in (random.choice(wkeys) for _ in wkeys) for i in weeks[_k]]
        samples.append([round(v, 4) for v in fit([X[i] for i in idx], [y[i] for i in idx])])

    # leave-one-week-out backtest on in-season weeks (weekly sums)
    ape_by_month = defaultdict(list)
    for wk in wkeys:
        idx = weeks[wk]
        if not all(X[i][1] for i in idx) or len(idx) < 5:
            continue
        train = [i for i in range(len(days)) if i not in set(idx)]
        bt = fit([X[i] for i in train], [y[i] for i in train])
        pred = sum(math.exp(predict(bt, X[i])) - 1 for i in idx)
        act = sum(hist[days[i]] for i in idx)
        ape_by_month[days[idx[0]].month].append(abs(pred - act) / act * 100)
    mape_month = {m: round(statistics.mean(v), 1) for m, v in sorted(ape_by_month.items())}
    all_ape = [v for vs in ape_by_month.values() for v in vs]
    mape = round(statistics.mean(all_ape), 1)

    # forecast noise: daily and weekly absolute % error of the TVB forecast vs actual, per month
    noise = {}
    by_m = defaultdict(list)
    for k, v in hist.items():
        if k >= date(2025, 11, 4) and k in fc and fc[k] > 500:
            by_m[k.month].append(abs(v - fc[k]) / fc[k] * 100)
    for m, v in sorted(by_m.items()):
        v = sorted(v)
        noise[str(m)] = {"p50": round(v[len(v) // 2], 1), "p80": round(v[int(len(v) * 0.8)], 1), "n": len(v)}

    # the same features fitted on the forecast series ("why the forecast expects this")
    fdays = sorted(fc)
    Xf = [features(k, seasons, hshare, snow) for k in fdays]
    for row, k in zip(Xf, fdays):  # the forecast's 2026/27 winter gets the latest level (2025/26)
        if k > HIST_TO and row[FEATURES.index("open")] and not row[FEATURES.index("summer")]:
            row[FEATURES.index("level_w2526")] = 1.0
    beta_fc = fit(Xf, [math.log(fc[k] + 1) for k in fdays])

    # report
    def ci(j):
        v = sorted(s[j] for s in samples)
        return v[int(0.05 * len(v))], v[int(0.95 * len(v)) - 1]
    print(f"\nIn-sample R2 (log): {r2:.3f}   leave-one-week-out MAPE (in-season weeks): {mape} %")
    print("MAPE by month:", mape_month)
    print("Forecast error p80 by month (daily %):", {m: n["p80"] for m, n in noise.items()})
    print("\nCoefficients (log scale, 90 % CI), exp-1 = % effect:")
    for j, f in enumerate(FEATURES):
        lo, hi = ci(j)
        sig = "*" if lo > 0 or hi < 0 else " "
        print(f"  {sig} {f:14s} {beta[j]:+.3f}  [{lo:+.3f}, {hi:+.3f}]  {100 * (math.exp(beta[j]) - 1):+7.1f} %")

    # attribution check: 2026-W16 vs the same weekdays last year
    def attrib(a0, a1):
        A = list(drange(a0, a1))
        B = [k - timedelta(days=364) for k in A]
        yA = sum(hist[k] for k in A)
        yB = sum(hist[k] for k in B)
        w = [hist[k] + 1 for k in B]
        xa = [features(k, seasons, hshare, snow) for k in A]
        xb = [features(k, seasons, hshare, snow) for k in B]
        res = {}
        for g in sorted(set(GROUPS.values()) - {"base"}):
            js = [j for j, f in enumerate(FEATURES) if GROUPS[f] == g]
            D = sum(wi * sum(beta[j] * (xa[i][j] - xb[i][j]) for j in js) for i, wi in enumerate(w)) / sum(w)
            res[g] = round(yB * (math.exp(D) - 1))
        return yA, yB, res
    for a0, a1, lab in ((date(2026, 4, 13), date(2026, 4, 19), "2026-W16"), (date(2026, 3, 30), date(2026, 4, 5), "2026-W14"),
                        (date(2026, 4, 27), date(2026, 5, 3), "2026-W18 (season end)")):
        yA, yB, res = attrib(a0, a1)
        expl = sum(res.values())
        print(f"\n{lab}: actual {yA:,} vs same weekdays last year {yB:,} (gap {yA - yB:+,}); drivers sum {expl:+,}; residual {yA - yB - expl:+,}")
        for g, v in sorted(res.items(), key=lambda kv: -abs(kv[1])):
            if v:
                print(f"    {g:16s} {v:+,}")

    if a.dry_run:
        print("\nDry run: nothing written.")
        return

    spec = {"features": FEATURES, "groups": GROUPS, "markets": MARKETS, "ridge": RIDGE,
            "pairing": "A vs A-364 days (same weekdays last year)", "target": "log(stays+1)"}
    metrics = {"r2_log": round(r2, 3), "mape_in_season_weeks": mape, "mape_by_month": mape_month,
               "train_days": len(days), "train_from": str(min(days)), "train_to": str(max(days)), "bootstrap": N_BOOT}
    rows = []
    for k in sorted(set(hist) | set(fc)):
        xk = features(k, seasons, hshare, snow)
        if k > HIST_TO and xk[FEATURES.index("open")] and not xk[FEATURES.index("summer")]:
            xk[FEATURES.index("level_w2526")] = 1.0
        rows.append((str(k), VERSION, hist.get(k), fc.get(k), "history" if k < date(2025, 11, 4) else "actual" if k in hist else "forecast", json.dumps(xk)))
    sql = ["begin;",
           "delete from public.team_07_season_dates where source = 'detected';"]
    for s in seasons:
        sql.append("insert into public.team_07_season_dates (season, kind, open_date, close_date, source) values "
                   f"('{s['season']}', '{s['kind']}', '{s['open']}', {repr(str(s['close'])) if s['close'] else "'2099-01-01'"}, 'detected') "
                   "on conflict (season) do update set open_date = excluded.open_date, close_date = excluded.close_date, updated_at = now() "
                   "where public.team_07_season_dates.source = 'detected';")
    lit = lambda o: "'" + json.dumps(o).replace("'", "''") + "'::jsonb"
    sql.append("update public.team_07_driver_model set active = false;")
    sql.append("insert into public.team_07_driver_model (version, active, spec, coef, coef_fc, samples, metrics, noise) values "
               f"('{VERSION}', true, {lit(spec)}, {lit([round(v, 5) for v in beta])}, {lit([round(v, 5) for v in beta_fc])}, {lit(samples)}, {lit(metrics)}, {lit(noise)}) "
               "on conflict (version) do update set active = true, spec = excluded.spec, coef = excluded.coef, coef_fc = excluded.coef_fc, "
               "samples = excluded.samples, metrics = excluded.metrics, noise = excluded.noise, created_at = now();")
    sql.append("truncate public.team_07_features_daily;")
    for r in rows:
        sql.append("insert into public.team_07_features_daily (date, model_version, stays_hist, stays_fc, src, x) values "
                   f"('{r[0]}', '{r[1]}', {r[2] if r[2] is not None else 'null'}, {r[3] if r[3] is not None else 'null'}, '{r[4]}', {lit(json.loads(r[5]))});")
    sql.append("commit;")
    psql(None, stdin="\n".join(sql))
    print(f"\nWritten: model {VERSION} (active), {len(rows)} feature rows, {len(seasons)} seasons.")


if __name__ == "__main__":
    main()
