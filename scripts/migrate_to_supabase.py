#!/usr/bin/env python3
"""team-07 Demand Detective: create the team_07_* tables in the shared Supabase and load data/.

Usage (from the repository root):
    python3 scripts/migrate_to_supabase.py --dry-run        # parse files, print row counts, no DB access
    python3 scripts/migrate_to_supabase.py                  # schema + data, one transaction (all or nothing)
    python3 scripts/migrate_to_supabase.py --schema-only    # only supabase/01_schema.sql
    python3 scripts/migrate_to_supabase.py --enrich         # holidays (OpenHolidays) + weather (Open-Meteo)
    python3 scripts/migrate_to_supabase.py --verify         # run scripts/verify_supabase.sql

Needs: psql on PATH and SUPABASE_DB_URL in .env.local (repository root, see .env.example). The URL is never printed.
Re-runnable: every load truncates its table first. Only team_07_* tables are touched.
Standard library only.
"""
import argparse
import csv
import io
import json
import os
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _env  # noqa: E402
DATA = ROOT / "data"
SCHEMA = ROOT / "supabase" / "01_schema.sql"
VERIFY = ROOT / "scripts" / "verify_supabase.sql"

F_STAYS = DATA / "Overnight stays Paznaun-Ischgl, November 2025 – April 2027" / "Overnight stays November 2025 – April 2027.csv"
F_BEDS = DATA / "Available beds Paznaun-Ischgl, February 2025 – November 2026" / "Available beds February 2025 – November 2026.csv"
F_LEAD = DATA / "Booking lead time Paznaun-Ischgl, 2023–2026" / "Booking lead time 2023–2026.csv"
F_EVENTS = DATA / "Event calendar Paznaun-Ischgl 2026–2027" / "Event calendar 2026–2027.csv"
F_INDEX = DATA / "Daily overnight index per Austrian tourism region 2022-2025" / "3222fc35-2bdb-45bd-b259-4652e2549f87.csv"
F_CONTWISE = DATA / "paznaun-ischgl-contwise-api" / "resources.json"

# Paznaun-Ischgl plus 4 peer ski regions (Regionsnummer in the JOANNEUM index file)
REGIONS = {"R54": "Paznaun - Ischgl", "R4": "Arlberg", "R28": "Kitzbühel Tourismus",
           "R71": "Serfaus-Fiss-Ladis", "R62": "Saalbach-Hinterglemm"}
VIENNA = ZoneInfo("Europe/Vienna")


def read_csv(path, **kw):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, **kw))


def nul(v):
    v = (v or "").strip()
    return v if v != "" else None


def village_name(city):
    """Normalise the Contwise contact_city to a village name."""
    city = " ".join((city or "").split())  # trim + collapse inner whitespace ('Galtür ' -> 'Galtür')
    if not city:
        return None
    return city.split(",")[0].strip() or None  # 'See, Paznaun' -> 'See'


def epoch_day(ms):
    return datetime.fromtimestamp(ms / 1000, VIENNA).date().isoformat()


def load_tables():
    """Return {table: (columns, rows)} in load order."""
    t = {}
    t["team_07_stays_daily"] = (
        ["date", "previous_year", "forecast", "actual"],
        [[r["date"], nul(r["previous_year"]), nul(r["forecast"]), nul(r["actual"])] for r in read_csv(F_STAYS)])
    t["team_07_free_beds"] = (
        ["date", "available_beds"],
        [[r["date"], nul(r["available_beds"])] for r in read_csv(F_BEDS)])
    lead_cols = ["week_start", "bookings_0_days_ahead", "bookings_8_days_ahead", "bookings_31_days_ahead",
                 "bookings_61_days_ahead", "bookings_90_days_ahead", "bookings_180_days_ahead"]
    t["team_07_lead_time"] = (lead_cols, [[nul(r[c]) for c in lead_cols] for r in read_csv(F_LEAD)])

    # Events: TVB calendar (one row per day, no village) + Contwise events (village, top_event)
    ev = [[r["date"], r["date"], None, r["event"].strip(), "false", "tvb"] for r in read_csv(F_EVENTS)]
    contwise = json.load(open(F_CONTWISE, encoding="utf-8"))
    n_events = 0
    for x in contwise:
        if x.get("objectType") != "event_phoenix":
            continue
        n_events += 1
        m = x["metadata"]
        top = "true" if m.get("top_event") == "1" else "false"
        village = village_name(m.get("contact_city"))
        name = str(x["name"]).strip()
        for d in json.loads(m["event_dates"]):  # one row per date range
            ev.append([epoch_day(d["fromDate"]["time"]), epoch_day(d["toDate"]["time"]), village, name, top, "contwise"])
    t["team_07_events"] = (["date", "end_date", "village", "name", "top_event", "source"], ev)

    # Village beds: totals only, no host names or contact fields are read
    beds, hosts = defaultdict(int), defaultdict(int)
    for x in contwise:
        if x.get("objectType") != "ServiceProvider":
            continue
        v = village_name(x["metadata"].get("contact_city"))
        n = int(x["metadata"].get("beds") or 0)
        if not v or n <= 0:  # skip hosts without a village or without listed beds
            continue
        beds[v] += n
        hosts[v] += 1
    t["team_07_village_beds"] = (["village", "beds", "host_count"],
                                 [[v, beds[v], hosts[v]] for v in sorted(beds, key=lambda k: -beds[k])])

    # Region index: long file, decimal comma, dd.mm.yyyy
    idx = []
    with open(F_INDEX, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            rid = r["Regionsnummer"]
            if rid in REGIONS and r["time_series"].strip():
                d = datetime.strptime(r["date"], "%d.%m.%Y").date().isoformat()
                idx.append([d, r["Region"], rid, r["time_series"].replace(",", ".")])
    t["team_07_region_index"] = (["date", "region", "reg_id", "index_value"], idx)
    return t


# ---------------------------------------------------------------- enrichment (open APIs, no keys)
# From autumn 2024, so the driver model (scripts/fit_driver_model.py) sees the holidays of last season too
H_FROM, H_TO = "2024-09-01", "2027-05-31"
W_FROM = "2024-09-01"  # weather archive start, same reason
H_COUNTRIES = ["DE", "NL", "BE", "DK", "SE", "CH", "AT"]
ISCHGL = (46.97, 10.29)
UA = {"User-Agent": "team-07-demand-detective/1.0 (TTF Hackathon)", "Accept": "application/json"}


def ssl_context():
    """Verified TLS. python.org builds on macOS ship without CA certs: use certifi or the system bundle."""
    try:
        import certifi  # optional
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for cafile in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
        if Path(cafile).exists():
            return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


SSL = ssl_context()


def get_json(url, params):
    full = url + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(full, headers=UA), timeout=60, context=SSL) as r:
        return json.load(r)


def easter(y):
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    return date(y, (h + l - 7 * m + 114) // 31, (h + l - 7 * m + 114) % 31 + 1).isoformat()


def fetch_holidays():
    """Same logic as the former n8n workflow 'team-07 · Enrich': DE per state, others per region list."""
    rows = []
    for c in H_COUNTRIES:
        for kind in ("School", "Public"):
            try:
                items = get_json(f"https://openholidaysapi.org/{kind}Holidays",
                                 {"countryIsoCode": c, "languageIsoCode": "EN", "validFrom": H_FROM, "validTo": H_TO})
            except Exception as e:  # one failing country must not stop the rest
                print(f"  warning: OpenHolidays {kind} {c} failed: {e}")
                items = []
            for h in items:
                names = h.get("name") or []
                name = next((n["text"] for n in names if n.get("language") == "EN"), names[0]["text"] if names else kind)
                typ = f"{kind.lower()}: {name}"
                codes = sorted({s["code"] for s in (h.get("subdivisions") or [])
                                if len(s.get("code", "").split("-")) == 2 and s["code"].split("-")[1].isalnum()})
                if c == "DE" and codes:
                    rows += [[c, code, h["startDate"], h["endDate"], typ] for code in codes]
                else:
                    region = ",".join(x.split("-")[1] for x in codes) if codes else None
                    rows.append([c, region, h["startDate"], h["endDate"], typ])
    for y in (2024, 2025, 2026, 2027):
        e = easter(y)
        rows.append(["AT", None, e, e, "easter: Easter Sunday"])
    uk = [("2024-12-21", "2025-01-05", "Christmas"), ("2025-02-17", "2025-02-23", "February half term"),
          ("2025-04-05", "2025-04-21", "Easter"), ("2025-12-20", "2026-01-04", "Christmas"), ("2026-02-16", "2026-02-22", "February half term"),
          ("2026-03-28", "2026-04-12", "Easter"), ("2026-12-19", "2027-01-03", "Christmas"),
          ("2027-02-15", "2027-02-21", "February half term"), ("2027-03-27", "2027-04-11", "Easter")]
    rows += [["UK", "England", a, b, f"school: {n} (hardcoded, approximate)"] for a, b, n in uk]
    return rows


def fetch_weather():
    """Ischgl daily weather: archive (lags ~3 days) + forecast (3 past days + 16 ahead); archive wins."""
    daily = "temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum"
    lat, lon = ISCHGL
    end = (date.today() - timedelta(days=3)).isoformat()
    out = {}
    fc = get_json("https://api.open-meteo.com/v1/forecast",
                  {"latitude": lat, "longitude": lon, "daily": daily, "timezone": "Europe/Vienna",
                   "past_days": 5, "forecast_days": 16})
    ar = get_json("https://archive-api.open-meteo.com/v1/archive",
                  {"latitude": lat, "longitude": lon, "daily": daily, "timezone": "Europe/Vienna",
                   "start_date": W_FROM, "end_date": end})
    for src in (fc, ar):  # archive second, so it overwrites forecast values for the same day
        d = src["daily"]
        for i, t in enumerate(d["time"]):
            out[t] = [t, "Ischgl", d["temperature_2m_max"][i], d["temperature_2m_min"][i],
                      d["precipitation_sum"][i], d["snowfall_sum"][i]]
    return [out[k] for k in sorted(out)]


def enrich_tables():
    print("Fetching holidays (OpenHolidays, ODbL) ...")
    h = fetch_holidays()
    print("Fetching weather (Open-Meteo, CC BY 4.0) ...")
    w = fetch_weather()
    if len(h) < 100 or len(w) < 30:  # never wipe the tables with a broken fetch
        sys.exit(f"ERROR: fetch looks incomplete (holidays {len(h)}, weather {len(w)}); nothing written.")
    return {
        "team_07_holidays": (["market", "region", "start_date", "end_date", "type"], h),
        "team_07_weather_daily": (["date", "location", "temp_max", "temp_min", "precip_mm", "snowfall_cm"], w),
    }


def build_load_sql(tables):
    """One SQL script: truncate + COPY ... FROM STDIN with inline data, per table."""
    out = io.StringIO()
    for name, (cols, rows) in tables.items():
        restart = " restart identity" if name in ("team_07_events", "team_07_holidays") else ""
        out.write(f"truncate table public.{name}{restart};\n")
        out.write(f"copy public.{name} ({', '.join(cols)}) from stdin with (format csv, null '\\N');\n")
        w = csv.writer(out, lineterminator="\n")
        for r in rows:
            w.writerow(["\\N" if v is None else v for v in r])
        out.write("\\.\n\n")
    return out.getvalue()


def db_url():
    return _env.require("SUPABASE_DB_URL", "(the Postgres connection string of your Supabase)")


def run_psql(url, args, stdin_text=None):
    cmd = ["psql", url, "-v", "ON_ERROR_STOP=1", "-X", "-q"] + args
    r = subprocess.run(cmd, input=stdin_text, text=True, capture_output=True)
    if r.returncode != 0:
        err = r.stderr.replace(url, "<SUPABASE_DB_URL>")
        sys.exit(f"psql failed:\n{err}")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="parse the files and print row counts only")
    ap.add_argument("--schema-only", action="store_true", help="only run supabase/01_schema.sql")
    ap.add_argument("--enrich", action="store_true", help="load holidays + weather from the open APIs")
    ap.add_argument("--verify", action="store_true", help="run scripts/verify_supabase.sql")
    a = ap.parse_args()

    if a.verify:
        print(run_psql(db_url(), ["-f", str(VERIFY)]))
        return

    if a.enrich:
        tables = enrich_tables()
        for name, (_, rows) in tables.items():
            print(f"  {name:24s} {len(rows):6d} rows")
        if a.dry_run:
            print("Dry run: nothing sent to the database.")
            return
        run_psql(db_url(), ["-1"], stdin_text=build_load_sql(tables))
        print("Enrichment loaded.")
        return

    if a.schema_only:
        run_psql(db_url(), ["-f", str(SCHEMA)])
        print("Schema created / up to date.")
        return

    tables = load_tables()
    print("Parsed from data/:")
    for name, (_, rows) in tables.items():
        print(f"  {name:24s} {len(rows):6d} rows")
    if a.dry_run:
        print("Dry run: nothing sent to the database.")
        return

    url = db_url()
    print("Creating tables ...")
    run_psql(url, ["-f", str(SCHEMA)])
    print("Loading data (single transaction) ...")
    run_psql(url, ["-1"], stdin_text=build_load_sql(tables))
    print("Done. Run scripts/verify_supabase.sql to check the numbers.")


if __name__ == "__main__":
    main()
