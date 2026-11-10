"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CloudSnow, Droplets, MapPin, Minus, PartyPopper, School, Snowflake, Sparkles, Thermometer, X } from "lucide-react";
import type { DashboardData, Day } from "@/lib/dashboard";
import { MARKETS, fmtDate, fmtInt, fmtRange, fmtShare, fmtSignedInt, fmtSignedPct } from "@/lib/dashboard";
import { explainHref } from "@/components/agent/links";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (iso: string) => tr(WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]);

/**
 * Week detail drawer: the verdict first (one number, one sentence), the three figures, a clean day-by-day chart,
 * and what was going on that week (holidays, events, weather). One action at the bottom: explain this week.
 */
export function WeekPanel({ data, week, onClose }: { data: DashboardData; week: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const w = data.weeks.find((x) => x.week === week);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!w) return null;
  const days = data.days.filter((d) => d.date >= w.week_start && d.date <= w.week_end);
  const hol = data.holidays_by_week?.[w.week];
  const ev = data.events_by_week?.[w.week];
  const wx = data.weather_by_week?.[w.week];
  const hasActual = w.days_with_actual > 0;
  const fullyReported = hasActual && w.days_with_actual === w.days;

  // The headline comparison: actual vs last year once reported, else the forecast vs last year.
  const pct = hasActual ? w.gap_py_pct : w.fc_vs_py_pct;
  const abs = hasActual ? w.gap_py : w.fc_vs_py;
  const tone = pct === null || Math.abs(pct) < 0.5 ? "flat" : pct < 0 ? "down" : "up";
  const color = tone === "down" ? "var(--delta-bad)" : tone === "up" ? "var(--delta-good)" : "var(--text-muted)";
  const Arrow = tone === "down" ? ArrowDownRight : tone === "up" ? ArrowUpRight : Minus;
  const sentence =
    pct === null
      ? tr("No comparison with last year for this week.")
      : `${hasActual ? tr("Actual stays were") : tr("The forecast is")} ${Math.abs(pct).toFixed(1)} % ${pct < 0 ? tr("below") : tr("above")} ${tr("last year")} (${fmtSignedInt(abs)} ${tr("stays")}).`;

  const markets = MARKETS.filter((m) => (hol?.markets?.[m.code]?.coverage ?? 0) > 0).sort(
    (a, b) => (hol?.markets[b.code]?.coverage ?? 0) - (hol?.markets[a.code]?.coverage ?? 0),
  );
  const redDays = days.filter((d) => d.quality_flag === "red").length;
  const main = (d: Day) => (d.actual !== null ? d.actual : d.forecast);
  const maxDay = Math.max(1, ...days.flatMap((d) => [d.actual ?? 0, d.forecast ?? 0, d.previous_year ?? 0]));

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer !gap-0 !p-0" role="dialog" aria-modal="true" aria-labelledby="week-panel-title">
        {/* header */}
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-6 pb-4 pt-5">
          <div className="min-w-0">
            <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">{tr("Week detail")}</p>
            <h2 id="week-panel-title" className="mt-1 text-3xl">{w.week}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {fmtRange(w.week_start, w.week_end)}
              </span>
              <span className={`border px-1.5 py-0.5 text-[11px] font-bold ${hasActual ? "border-slate-900 text-[color:var(--text)]" : "border-line text-muted"}`}>
                {hasActual ? (fullyReported ? tr("Fully reported") : `${w.days_with_actual} / ${w.days} ${tr("days reported")}`) : tr("Forecast only")}
              </span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={tr("Close week detail")}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-slate-600 transition-colors hover:border-slate-900 hover:text-[color:var(--text)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-7 px-6 py-6">
          {/* verdict */}
          <section aria-label={tr("Change vs last year")}>
            <div className="flex items-end justify-between gap-4">
              <p className="font-display text-5xl font-black leading-none tabular-nums" style={{ color }}>
                {pct === null ? "–" : fmtSignedPct(pct)}
              </p>
              <span className="inline-flex items-center gap-1.5 pb-1 text-xs font-semibold text-muted">
                <Arrow className="h-4 w-4" style={{ color }} aria-hidden="true" />
                {hasActual ? tr("actual vs last year") : tr("forecast vs last year")}
              </span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{sentence}</p>
            {hasActual && w.gap_fc_pct !== null && (
              <p className="mt-1 text-sm text-slate-600">
                {tr("Against the forecast")}:{" "}
                <b className={w.gap_fc_pct < 0 ? "delta-bad" : "delta-good"}>{fmtSignedPct(w.gap_fc_pct)}</b>{" "}
                <span className="tabular-nums text-muted">({fmtSignedInt(w.gap_fc)} {tr("stays")})</span>
              </p>
            )}
          </section>

          {/* the three figures + occupancy */}
          <section>
            <dl className="grid grid-cols-3 border border-line">
              <Figure label={tr("Actual")} value={fmtInt(w.actual)} swatch="var(--viz-actual)" />
              <Figure label={tr("Forecast")} value={fmtInt(w.forecast)} swatch="var(--viz-forecast)" border />
              <Figure label={tr("Last year")} value={fmtInt(w.previous_year)} swatch="var(--viz-py)" border />
            </dl>
            <div className="border border-t-0 border-line px-4 py-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="kpi-label">{tr("Bed occupancy (proxy)")}</span>
                <span className="font-display text-base font-extrabold tabular-nums">{w.occupancy === null ? "–" : fmtShare(w.occupancy, 0)}</span>
              </div>
              {w.occupancy !== null ? (
                <div className="mt-2 h-1.5 bg-surface-muted">
                  <div className="h-1.5 bg-accent" style={{ width: `${Math.min(1, w.occupancy) * 100}%` }} />
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">{tr("Shown once actual stays are reported.")}</p>
              )}
            </div>
          </section>

          {/* day by day */}
          <section aria-labelledby="wp-days">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 id="wp-days" className="dash-h2">{tr("Day by day")}</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3" style={{ background: hasActual ? "var(--viz-actual)" : "var(--viz-forecast)" }} />
                  {hasActual ? tr("Actual") : tr("Forecast")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-0.5" style={{ background: "var(--viz-py)" }} />
                  {tr("Last year")}
                </span>
              </div>
            </div>
            <ul className="flex flex-col">
              {days.map((d) => {
                const v = main(d);
                const isActual = d.actual !== null;
                const noForecast = d.quality_flag === "red" && !isActual;
                const diff = v !== null && d.previous_year ? ((v - d.previous_year) / d.previous_year) * 100 : null;
                return (
                  <li key={d.date} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 border-b border-line py-2 last:border-b-0">
                    <span className="text-sm">
                      <b className="block font-display text-[11px] uppercase tracking-[0.08em] text-muted">{weekday(d.date)}</b>
                      <span className="tabular-nums">{fmtDate(d.date, false)}</span>
                    </span>
                    <div className="relative h-3 bg-surface-muted" title={`${tr("Last year")}: ${fmtInt(d.previous_year)}`}>
                      {!noForecast && v !== null && (
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{ width: `${(v / maxDay) * 100}%`, background: isActual ? "var(--viz-actual)" : "var(--viz-forecast)" }}
                        />
                      )}
                      {d.previous_year !== null && (
                        <span className="absolute -inset-y-1 w-0.5" style={{ left: `calc(${(d.previous_year / maxDay) * 100}% - 1px)`, background: "var(--viz-py)" }} aria-hidden="true" />
                      )}
                    </div>
                    <span className="text-right">
                      {noForecast ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--delta-bad)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-critical)]" aria-hidden="true" />
                          {tr("no forecast")}
                        </span>
                      ) : (
                        <>
                          <b className="block font-display text-sm tabular-nums">{fmtInt(v)}</b>
                          {diff !== null && (
                            <span className={`text-[11px] font-semibold tabular-nums ${Math.abs(diff) < 0.5 ? "text-muted" : diff < 0 ? "delta-bad" : "delta-good"}`}>
                              {fmtSignedPct(diff, 0)}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {redDays > 0 && (
              <p className="mt-3 border-l-2 border-[var(--status-critical)] pl-3 text-xs text-slate-600">
                {redDays === 1 ? tr("1 day has no forecast") : `${redDays} ${tr("days have no forecast")}`}
                {tr(", so their gap is not a real change in demand. Check with Feratel.")}
              </p>
            )}
          </section>

          {/* context */}
          <section aria-labelledby="wp-context" className="flex flex-col gap-5">
            <h3 id="wp-context" className="dash-h2">{tr("What was going on that week")}</h3>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                <School className="h-4 w-4 text-accent" aria-hidden="true" />
                {tr("School holidays in source markets")}
              </p>
              {markets.length === 0 ? (
                <p className="text-sm text-muted">{tr("No school holidays in the tracked markets.")}</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {markets.map((m) => {
                    const mh = hol!.markets[m.code];
                    const names = [...new Set(mh.names.map((n) => n.trim()))].filter((n, i, a) => a.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);
                    return (
                      <li key={m.code}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">
                            <b className="mr-1.5 inline-block w-7 font-display text-xs">{m.code}</b>
                            {tr(m.name)}
                            {names.length > 0 && <span className="text-muted"> · {names.join(", ")}</span>}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">{Math.round(mh.coverage * 100)} %</span>
                        </div>
                        <div className="mt-1 h-1.5 bg-surface-muted">
                          <div className="h-1.5" style={{ width: `${mh.coverage * 100}%`, background: mh.coverage >= 0.5 ? "var(--accent)" : "var(--seq-300)" }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hol?.public && hol.public.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {tr("Public holidays")}: {hol.public.join(" · ")}
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                <PartyPopper className="h-4 w-4 text-accent" aria-hidden="true" />
                {tr("Events")}
                {ev && <span className="font-normal text-muted">· {ev.count} {tr("in the valley")}</span>}
              </p>
              {!ev || ev.top.length === 0 ? (
                <p className="text-sm text-muted">{ev ? tr("No top events this week.") : tr("No events listed for this week.")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--line)] border border-line">
                  {ev.top.map((t, i) => (
                    <li key={`${t.date}-${t.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-10 shrink-0 text-center">
                        <b className="block font-display text-base leading-none">{t.date.slice(8, 10)}</b>
                        <span className="font-display text-[10px] uppercase tracking-wider text-muted">{fmtDate(t.date, false).split(" ")[1]}</span>
                      </span>
                      <span className="min-w-0 text-sm">
                        <b className="block truncate">{t.name}</b>
                        {t.village && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {t.village}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                <CloudSnow className="h-4 w-4 text-accent" aria-hidden="true" />
                {tr("Weather in Ischgl")}
              </p>
              {!wx ? (
                <p className="text-sm text-muted">{tr("No weather data for this week (weather starts 4 Nov 2025 and runs 16 days ahead).")}</p>
              ) : (
                <dl className="grid grid-cols-3 border border-line">
                  <Mini icon={<Snowflake className="h-3.5 w-3.5" aria-hidden="true" />} label={tr("Snowfall")} value={`${wx.snowfall_cm ?? 0} cm`} />
                  <Mini icon={<Thermometer className="h-3.5 w-3.5" aria-hidden="true" />} label={tr("Avg max")} value={wx.temp_max_avg === null ? "–" : `${wx.temp_max_avg} °C`} border />
                  <Mini icon={<Droplets className="h-3.5 w-3.5" aria-hidden="true" />} label={tr("Wet days")} value={`${wx.wet_days} / ${wx.days}`} border />
                </dl>
              )}
            </div>
          </section>
        </div>

        {/* the one action */}
        <footer className="sticky bottom-0 mt-auto border-t border-line bg-white px-6 py-4">
          <Link href={explainHref({ from: w.week_start, to: w.week_end }, "py")} className="btn w-full justify-between" onClick={onClose}>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {tr("Explain this week")}
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-2 text-center text-xs text-muted">{tr("The agent shows the reasons behind the change, from holidays to weather and events.")}</p>
        </footer>
      </aside>
    </>
  );
}

function Figure({ label, value, swatch, border }: { label: string; value: string; swatch: string; border?: boolean }) {
  return (
    <div className={`px-4 py-3 ${border ? "border-l border-line" : ""}`}>
      <dt className="kpi-label flex items-center gap-1.5">
        <span className="h-2 w-2" style={{ background: swatch }} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function Mini({ icon, label, value, border }: { icon: React.ReactNode; label: string; value: string; border?: boolean }) {
  return (
    <div className={`px-3 py-2.5 ${border ? "border-l border-line" : ""}`}>
      <dt className="flex items-center gap-1 text-[11px] font-semibold text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-base font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}
