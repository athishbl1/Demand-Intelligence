/**
 * Dashboard data: one call to the n8n workflow "team-07 · API overview" (GET team-07-overview),
 * which reads the team_07_* tables in the shared Supabase. If n8n cannot be reached, the app falls
 * back to the snapshot in public/demo/overview.json so the dashboard never goes blank in a demo.
 */
import { callWebhook, WebhookError } from "@/lib/n8n";
import { getLang } from "@/lib/i18n";

export const OVERVIEW_WEBHOOK = "team-07-overview";
export const DEMO_SNAPSHOT = "/demo/overview.json";

export type QualityFlag = "green" | "yellow" | "red";

export interface Day {
  date: string;
  actual: number | null;
  forecast: number | null;
  previous_year: number | null;
  available_beds: number | null;
  occupancy: number | null;
  gap_fc: number | null;
  gap_fc_pct: number | null;
  gap_py: number | null;
  gap_py_pct: number | null;
  quality_flag: QualityFlag;
}

export interface Week {
  week: string; // ISO week, e.g. "2026-W16"
  week_start: string;
  week_end: string;
  days: number;
  days_with_actual: number;
  actual: number | null;
  forecast: number | null;
  previous_year: number | null;
  forecast_cmp: number | null;
  previous_year_cmp: number | null;
  occupancy: number | null;
  red_days: number;
  yellow_days: number;
  gap_fc: number | null;
  gap_fc_pct: number | null;
  gap_py: number | null;
  gap_py_pct: number | null;
  fc_vs_py: number | null;
  fc_vs_py_pct: number | null;
}

export interface Kpis {
  season: string;
  actual: number;
  forecast: number;
  previous_year: number;
  gap_fc: number;
  gap_fc_pct: number;
  gap_py: number;
  gap_py_pct: number;
  occupancy_avg: number | null;
  free_beds_latest: { date: string; beds: number } | null;
  next_season: {
    season: string;
    forecast: number;
    previous_year: number;
    fc_vs_py: number;
    fc_vs_py_pct: number;
  } | null;
}

export interface QualityItem {
  date: string;
  forecast: number | null;
  previous_year?: number | null;
  actual: number | null;
  gap_fc_pct?: number | null;
  reason: string;
}

export interface Quality {
  days: number;
  red_days: number;
  yellow_days: number;
  green_days: number;
  last_actual: string;
  red_list: QualityItem[] | null;
  yellow_list: QualityItem[] | null;
}

export interface MarketHoliday {
  coverage: number; // 0..1, share of the market's regions on school holiday, averaged over the week
  days: number;
  names: string[];
}

export interface HolidayWeek {
  markets: Record<string, MarketHoliday>;
  public: string[];
}

export interface TopEvent {
  name: string;
  village: string | null;
  date: string;
}

export interface EventWeek {
  count: number;
  top: TopEvent[];
}

export interface WeatherWeek {
  snowfall_cm: number | null;
  temp_max_avg: number | null;
  temp_min_avg: number | null;
  wet_days: number;
  days: number;
}

export interface LeadSeason {
  season: string;
  d0: number;
  d8: number;
  d31: number;
  d61: number;
  d90: number;
  d180: number;
  total: number;
}

export interface PeerWeek {
  week_start: string;
  values: Record<string, number>;
  rank_r54: number;
}

export interface DashboardData {
  generated_at: string;
  days: Day[];
  weeks: Week[];
  kpis: Kpis;
  quality: Quality;
  village_beds: { village: string; beds: number; host_count: number }[];
  holidays_by_week: Record<string, HolidayWeek> | null;
  events_by_week: Record<string, EventWeek> | null;
  weather_by_week: Record<string, WeatherWeek> | null;
  lead_time: { buckets: string[]; seasons: LeadSeason[] | null; weeks: { week_start: string; total: number }[] | null };
  peers: { regions: { reg_id: string; region: string }[]; weeks: PeerWeek[] | null };
  sources: string[];
}

export type DataSource = "live" | "demo";

export interface DashboardResult {
  data: DashboardData;
  source: DataSource;
  /** Why the live call failed, when the demo snapshot is shown. */
  error?: string;
}

function isDashboard(value: unknown): value is DashboardData {
  return !!value && typeof value === "object" && Array.isArray((value as DashboardData).days) && Array.isArray((value as DashboardData).weeks);
}

/** Live data from n8n, or the demo snapshot when n8n does not answer. */
export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardResult> {
  let reason: string;
  try {
    const raw = await callWebhook<unknown>(OVERVIEW_WEBHOOK, undefined, { method: "GET", timeoutMs: 30_000, signal });
    const value = Array.isArray(raw) ? raw[0] : raw; // n8n may wrap a single item in a list
    if (isDashboard(value)) return { data: value, source: "live" };
    reason = "n8n answered, but not with dashboard data.";
  } catch (error) {
    if (signal?.aborted) throw error;
    reason = error instanceof WebhookError || error instanceof Error ? error.message : String(error);
  }
  const response = await fetch(DEMO_SNAPSHOT, { signal });
  if (!response.ok) throw new Error(`${reason} The demo snapshot could not be loaded either.`);
  return { data: (await response.json()) as DashboardData, source: "demo", error: reason };
}

/* ------------------------------------------------------------------ formatting (fixed en-US locale) */

// Number format follows the language of the page (1,234 in English, 1.234 in German).
const numLocale = () => (getLang() === "de" ? "de-AT" : "en-US");
const intFmt = { format: (v: number) => new Intl.NumberFormat(numLocale(), { maximumFractionDigits: 0, useGrouping: true }).format(v) };
const compactFmt = { format: (v: number) => new Intl.NumberFormat(numLocale(), { notation: "compact", maximumFractionDigits: 2 }).format(v) };

export const fmtInt = (v: number | null | undefined) => (v === null || v === undefined ? "–" : intFmt.format(v));

export const fmtCompact = (v: number | null | undefined) => (v === null || v === undefined ? "–" : compactFmt.format(v));

/** "3.1 %" in English, "3,1 %" in German */
export const fmtDec = (v: number, digits = 1) => (getLang() === "de" ? v.toFixed(digits).replace(".", ",") : v.toFixed(digits));

export function fmtSignedPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return "–";
  const s = fmtDec(Math.abs(v), digits);
  return v > 0 ? `+${s} %` : v < 0 ? `−${s} %` : `${s} %`;
}

export function fmtSignedInt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  return v > 0 ? `+${intFmt.format(v)}` : v < 0 ? `−${intFmt.format(Math.abs(v))}` : "0";
}

export const fmtShare = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "–" : `${fmtDec(v * 100, digits)} %`;

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_DE = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const mon = (i: number) => (getLang() === "de" ? MONTHS_DE : MONTHS_EN)[i];

/** "2026-04-13" -> "13 Apr 2026" (no time zone shifts: parsed as plain text). */
export function fmtDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return withYear ? `${d} ${mon(m - 1)} ${y}` : `${d} ${mon(m - 1)}`;
}

export function fmtRange(a: string, b: string): string {
  const sameYear = a.slice(0, 4) === b.slice(0, 4);
  return `${fmtDate(a, !sameYear)} – ${fmtDate(b)}`;
}

export const monthLabel = (iso: string) => mon(Number(iso.slice(5, 7)) - 1);

/* ------------------------------------------------------------------ seasons */

export interface Season {
  id: string;
  label: string;
  from: string;
  to: string;
}

export const SEASONS: Season[] = [
  { id: "w2526", label: "Winter 25/26", from: "2025-11-03", to: "2026-05-03" },
  { id: "s26", label: "Summer 26", from: "2026-05-04", to: "2026-11-01" },
  { id: "w2627", label: "Winter 26/27 (forecast)", from: "2026-11-02", to: "2027-04-04" },
  { id: "all", label: "All data", from: "0000-01-01", to: "9999-12-31" },
];

export const inSeason = (iso: string, s: Season) => iso >= s.from && iso <= s.to;

/**
 * The two seasons that matter for planning: last winter (reported) and next winter (forecast).
 * Summer and "all data" mix reported and forecast figures, which reads as noise, so every season
 * picker in the dashboard offers just these two, in the same order, for one consistent view.
 */
/** The seasons the Overview offers: both winters and the summer between them (no "all"). */
export const OVERVIEW_SEASONS: Season[] = SEASONS.filter((s) => s.id !== "all");

export const MAIN_SEASONS: Season[] = SEASONS.filter((s) => s.id === "w2526" || s.id === "w2627");

/** Market codes in display order, with names. */
export const MARKETS: { code: string; name: string }[] = [
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "UK", name: "United Kingdom" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
];

/** The comparable gap of a week: vs PY when actuals exist, else forecast vs PY. */
export function weekGapPy(w: Week): { value: number | null; pct: number | null; basis: "actual" | "forecast" } {
  if (w.days_with_actual > 0) return { value: w.gap_py, pct: w.gap_py_pct, basis: "actual" };
  return { value: w.fc_vs_py, pct: w.fc_vs_py_pct, basis: "forecast" };
}
