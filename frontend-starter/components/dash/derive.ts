/**
 * Figures derived from the n8n answer (DashboardData). Everything here is computed from the live
 * payload: no sample values, no fixed dates. Shared by the dashboard tabs.
 */
import type { DashboardData, Day, Week } from "@/lib/dashboard";
import { fmtDate, fmtInt, fmtRange, fmtSignedPct, OVERVIEW_SEASONS, MARKETS, SEASONS, inSeason, weekGapPy } from "@/lib/dashboard";

export const marketName = (code: string) => MARKETS.find((m) => m.code === code)?.name ?? code;

/** Reference date of the answer ("today" for the data), YYYY-MM-DD. */
export const refDate = (d: DashboardData) => d.generated_at.slice(0, 10);

/** Whole days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);

/* ------------------------------------------------------------------ months */

export interface MonthRow {
  month: string; // YYYY-MM
  /** First and last day of the month that are in the data (and in the selected season). */
  from: string;
  to: string;
  days: number;
  daysWithActual: number;
  actual: number | null;
  forecast: number;
  previousYear: number;
  /** Forecast and last year over the same days that have an actual, for a fair comparison. */
  forecastCmp: number;
  previousYearCmp: number;
  gapFcPct: number | null;
  gapPyPct: number | null;
  fcVsPyPct: number | null;
  occupancy: number | null;
  redDays: number;
}

export function monthly(days: Day[]): MonthRow[] {
  const map = new Map<string, Day[]>();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(d);
  }
  return [...map.entries()].map(([month, list]) => {
    const withA = list.filter((d) => d.actual !== null);
    const actual = withA.length ? withA.reduce((s, d) => s + (d.actual ?? 0), 0) : null;
    const forecast = list.reduce((s, d) => s + (d.forecast ?? 0), 0);
    const previousYear = list.reduce((s, d) => s + (d.previous_year ?? 0), 0);
    const forecastCmp = withA.reduce((s, d) => s + (d.forecast ?? 0), 0);
    const previousYearCmp = withA.reduce((s, d) => s + (d.previous_year ?? 0), 0);
    const occ = list.filter((d) => d.occupancy !== null);
    return {
      month,
      from: list[0].date,
      to: list[list.length - 1].date,
      days: list.length,
      daysWithActual: withA.length,
      actual,
      forecast,
      previousYear,
      forecastCmp,
      previousYearCmp,
      gapFcPct: actual !== null ? pct(actual, forecastCmp) : null,
      gapPyPct: actual !== null ? pct(actual, previousYearCmp) : null,
      fcVsPyPct: pct(forecast, previousYear),
      occupancy: occ.length ? occ.reduce((s, d) => s + (d.occupancy ?? 0), 0) / occ.length : null,
      redDays: list.filter((d) => d.quality_flag === "red").length,
    };
  });
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (ym: string) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/* ------------------------------------------------------------------ pace (cumulative) */

export interface PacePoint {
  date: string;
  actual: number | null;
  forecast: number;
  previousYear: number;
}

/** Running totals over a season, day by day. Actual stops at the last reported day. */
export function pace(days: Day[]): PacePoint[] {
  let a = 0;
  let f = 0;
  let p = 0;
  let seenGap = false;
  return days.map((d) => {
    f += d.forecast ?? 0;
    p += d.previous_year ?? 0;
    if (d.actual === null) seenGap = true;
    else if (!seenGap) a += d.actual;
    return { date: d.date, actual: seenGap ? null : a, forecast: f, previousYear: p };
  });
}

/* ------------------------------------------------------------------ seasons */

export const seasonById = (id: string) => SEASONS.find((s) => s.id === id) ?? SEASONS[0];
export const seasonDays = (d: DashboardData, id: string) => d.days.filter((x) => inSeason(x.date, seasonById(id)));
export const seasonWeeks = (d: DashboardData, id: string) => d.weeks.filter((w) => inSeason(w.week_start, seasonById(id)));

/** Seasons that actually have data in this answer (without "All data"). */
export function seasonsWithData(d: DashboardData) {
  return SEASONS.filter((s) => s.id !== "all" && d.days.some((x) => inSeason(x.date, s)));
}

export interface SeasonKpiSummary {
  season: { id: string; label: string; from: string; to: string };
  /** The season has at least one reported day. */
  hasActual: boolean;
  /** Main headline for the tile: the actual total once reported, otherwise the forecast total. */
  actual: number | null;
  /** Same days as `actual` (or the whole season when there is no actual yet). */
  forecastCmp: number;
  previousYearCmp: number;
  /** Whole-season totals, for the "full season" outlook tile. */
  forecast: number;
  previousYear: number;
  gapFcPct: number | null;
  gapFc: number | null;
  gapPyPct: number | null;
  gapPy: number | null;
  fcVsPyPct: number | null;
  fcVsPy: number;
  occupancyAvg: number | null;
  /** The part of the season this answer actually covers, for the tile's small print. */
  rangeLabel: string;
}

/** KPI-tile totals for one season (or "all"), recomputed client-side from the weekly series. */
export function seasonKpiSummary(d: DashboardData, seasonId: string): SeasonKpiSummary {
  const season = seasonId === "all" ? SEASONS.find((s) => s.id === "all")! : (OVERVIEW_SEASONS.find((s) => s.id === seasonId) ?? OVERVIEW_SEASONS[0]);
  const weeks = d.weeks.filter((w) => inSeason(w.week_start, season));
  const reported = weeks.filter((w) => w.days_with_actual > 0);
  const sum = (f: (w: Week) => number | null) => weeks.reduce((s, w) => s + (f(w) ?? 0), 0);
  const hasActual = reported.length > 0;
  const actual = hasActual ? sum((w) => w.actual) : null;
  const forecastCmp = hasActual ? reported.reduce((s, w) => s + (w.forecast_cmp ?? 0), 0) : sum((w) => w.forecast);
  const previousYearCmp = hasActual ? reported.reduce((s, w) => s + (w.previous_year_cmp ?? 0), 0) : sum((w) => w.previous_year);
  const forecast = sum((w) => w.forecast);
  const previousYear = sum((w) => w.previous_year);
  const occ = weeks.filter((w) => w.occupancy !== null);
  const bounds = weeks.length ? fmtRange(weeks[0].week_start, weeks[weeks.length - 1].week_end) : "–";
  return {
    season,
    hasActual,
    actual,
    forecastCmp,
    previousYearCmp,
    forecast,
    previousYear,
    gapFcPct: actual !== null ? pct(actual, forecastCmp) : null,
    gapFc: actual !== null ? actual - forecastCmp : null,
    gapPyPct: actual !== null ? pct(actual, previousYearCmp) : null,
    gapPy: actual !== null ? actual - previousYearCmp : null,
    fcVsPyPct: pct(forecast, previousYear),
    fcVsPy: forecast - previousYear,
    occupancyAvg: occ.length ? occ.reduce((s, w) => s + (w.occupancy ?? 0), 0) / occ.length : null,
    rangeLabel: bounds,
  };
}

/* ------------------------------------------------------------------ insights */

export type Tone = "good" | "bad" | "neutral" | "warn";
export interface Insight {
  tone: Tone;
  title: string;
  detail: string;
  week?: string;
}

const topMarkets = (d: DashboardData, week: string, min = 0.25) =>
  Object.entries(d.holidays_by_week?.[week]?.markets ?? {})
    .filter(([, m]) => m.coverage >= min)
    .sort((a, b) => b[1].coverage - a[1].coverage)
    .map(([c]) => c);

/** Plain-language findings, each computed by a fixed rule from the payload. */
export function insights(d: DashboardData): Insight[] {
  const out: Insight[] = [];
  const k = d.kpis;
  const ref = refDate(d);

  if (k.next_season) {
    const n = k.next_season;
    out.push({
      tone: n.fc_vs_py_pct >= 0 ? "good" : "bad",
      title: `${n.season.split(" (")[0]} forecast ${fmtSignedPct(n.fc_vs_py_pct)} vs last year`,
      detail: `${fmtInt(n.forecast)} overnight stays forecast against ${fmtInt(n.previous_year)} (${n.fc_vs_py >= 0 ? "+" : "−"}${fmtInt(Math.abs(n.fc_vs_py))}).`,
    });
  }

  // Weakest upcoming open week (forecast vs last year), ignoring near-empty off-season weeks.
  const upcoming = d.weeks.filter((w) => w.week_end >= ref && w.days_with_actual === 0 && (w.previous_year ?? 0) >= 5000);
  const weakest = [...upcoming].sort((a, b) => (a.fc_vs_py_pct ?? 0) - (b.fc_vs_py_pct ?? 0))[0];
  if (weakest && (weakest.fc_vs_py_pct ?? 0) < 0) {
    const m = topMarkets(d, weakest.week);
    out.push({
      tone: "bad",
      title: `Weakest week ahead: ${weakest.week} (${fmtSignedPct(weakest.fc_vs_py_pct)})`,
      detail: `${fmtDate(weakest.week_start)}: ${fmtInt(weakest.forecast)} forecast vs ${fmtInt(weakest.previous_year)} last year, starts in ${daysBetween(ref, weakest.week_start)} days.${
        m.length ? ` On school holiday: ${m.map(marketName).join(", ")}.` : " No major source market on school holiday."
      }`,
      week: weakest.week,
    });
  }
  const strongest = [...upcoming].sort((a, b) => (b.fc_vs_py_pct ?? 0) - (a.fc_vs_py_pct ?? 0))[0];
  if (strongest && (strongest.fc_vs_py_pct ?? 0) > 0) {
    out.push({
      tone: "good",
      title: `Strongest week ahead: ${strongest.week} (${fmtSignedPct(strongest.fc_vs_py_pct)})`,
      detail: `${fmtInt(strongest.forecast)} forecast vs ${fmtInt(strongest.previous_year)} last year. Demand is ahead of last year here, so discounts are not needed.`,
      week: strongest.week,
    });
  }

  out.push({
    tone: k.gap_fc_pct >= 0 ? "good" : "bad",
    title: `${k.season.split(" (")[0]}: actual ${fmtSignedPct(k.gap_fc_pct)} vs forecast`,
    detail: `${fmtInt(k.actual)} actual against ${fmtInt(k.forecast)} forecast and ${fmtInt(k.previous_year)} the year before (${fmtSignedPct(k.gap_py_pct)}).`,
  });

  const upcomingRed = (d.quality.red_list ?? []).filter((r) => r.actual === null && r.date >= ref);
  if (upcomingRed.length) {
    out.push({
      tone: "warn",
      title: `${upcomingRed.length} upcoming day${upcomingRed.length > 1 ? "s" : ""} without a forecast`,
      detail: `${upcomingRed.slice(0, 6).map((r) => fmtDate(r.date, false)).join(", ")}${upcomingRed.length > 6 ? " …" : ""}. Gaps on these days are not real demand changes.`,
    });
  }

  const lag = daysBetween(d.quality.last_actual, ref);
  out.push({
    tone: lag > 10 ? "warn" : "neutral",
    title: `Actuals reported until ${fmtDate(d.quality.last_actual)}`,
    detail: `${lag} day${lag === 1 ? "" : "s"} behind the data date ${fmtDate(ref)}. Later days are forecast only.`,
  });

  return out;
}

/* ------------------------------------------------------------------ biggest movers */

export function movers(weeks: Week[], basis: "py" | "fc", dir: "down" | "up", n = 6) {
  const full = weeks.filter((w) => w.days === 7 && w.days_with_actual === 7);
  const gap = (w: Week) => (basis === "py" ? w.gap_py : w.gap_fc) ?? 0;
  return full
    .filter((w) => (dir === "down" ? gap(w) < 0 : gap(w) > 0))
    .sort((a, b) => (dir === "down" ? gap(a) - gap(b) : gap(b) - gap(a)))
    .slice(0, n)
    .map((w) => ({ w, gap: gap(w), pct: basis === "py" ? w.gap_py_pct : w.gap_fc_pct }));
}

export { weekGapPy };

/* ------------------------------------------------------------------ CSV export */

type Cell = string | number | null | undefined;

/** Downloads rows as a UTF-8 CSV (Excel-friendly: BOM, semicolon-safe quoting). */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
