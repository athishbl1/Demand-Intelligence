/**
 * Business wording for the agent's answer: turns change types, severities and percentages into
 * short plain sentences. Pure functions over the n8n payload; nothing here is invented.
 */
import type { Alert, ChangeType, Confidence, Explanation, Reason } from "@/lib/agent";
import { direction } from "@/lib/agent";
import { activeLocale, tr } from "@/lib/i18n";
import { fmtDec } from "@/lib/dashboard";

export const CHANGE_PLAIN: Record<ChangeType, { title: string; meaning: string }> = {
  real_drop: { title: "Fewer guests than planned", meaning: "Stays fell below both the forecast and last year." },
  real_rise: { title: "More guests than planned", meaning: "Stays rose above both the forecast and last year." },
  expected_drop: { title: "Drop that was expected", meaning: "Stays fell versus last year, but the forecast had already predicted it." },
  expected_rise: { title: "Rise that was expected", meaning: "Stays rose versus last year, as the forecast had predicted." },
  forecast_too_high: { title: "Forecast was too optimistic", meaning: "Stays were in line with last year, but below the forecast." },
  forecast_too_low: { title: "Forecast was too cautious", meaning: "Stays were in line with last year, but above the forecast." },
  forecast_drop: { title: "Forecast below last year", meaning: "No actual stays yet; the forecast expects fewer guests than last year." },
  forecast_rise: { title: "Forecast above last year", meaning: "No actual stays yet; the forecast expects more guests than last year." },
  no_change: { title: "No real change", meaning: "Stays are within ±5 % of the forecast and of last year." },
  data_issue: { title: "Check the data first", meaning: "Some days have no forecast or missing figures, so gaps are not reliable." },
};

export const SEVERITY_PLAIN: Record<string, { label: string; tone: "high" | "medium" | "low" }> = {
  high: { label: "High impact", tone: "high" },
  medium: { label: "Medium impact", tone: "medium" },
  warning: { label: "Check data", tone: "medium" },
  info: { label: "For information", tone: "low" },
};

export const TONE_BAR: Record<"high" | "medium" | "low", string> = {
  high: "var(--accent)",
  medium: "#f59e0b",
  low: "#a3a7ad",
};

export const CONFIDENCE_PLAIN: Record<Confidence, { label: string; dots: number }> = {
  high: { label: "High confidence", dots: 3 },
  medium: { label: "Medium confidence", dots: 2 },
  low: { label: "Low confidence", dots: 1 },
};

export const EXPLAINS_PLAIN: Record<Reason["explains"], string> = {
  expected: "Why the forecast already expected it",
  miss: "Why stays missed the forecast",
  both: "The whole change",
};

/** "55.0 % below last year" / "3.1 % above the forecast" / "in line with last year" */
export function deltaWords(pct: number | null | undefined, ref: "last year" | "the forecast"): string {
  const r = tr(ref);
  if (pct === null || pct === undefined || Number.isNaN(pct)) return tr("no comparison with {ref}", { ref: r });
  if (Math.abs(pct) < 0.5) return tr("in line with {ref}", { ref: r });
  return tr(pct < 0 ? "{pct} % below {ref}" : "{pct} % above {ref}", { pct: fmtDec(Math.abs(pct)), ref: r });
}

export const signedPct = (pct: number | null | undefined) =>
  pct === null || pct === undefined ? "–" : `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${fmtDec(Math.abs(pct))} %`;

/** Main comparison of an answer: the percentage the headline is about. */
export function mainDelta(e: Explanation): { pct: number | null; ref: "last year" | "the forecast" } {
  const t = e.totals;
  const hasAct = t.days_with_actual > 0;
  if (!hasAct) return { pct: t.fc_vs_py_pct, ref: "last year" };
  return e.scope.compare === "fc" ? { pct: t.gap_fc_pct ?? null, ref: "the forecast" } : { pct: t.gap_py_pct ?? null, ref: "last year" };
}

export const dirTone = (t: ChangeType) => {
  const d = direction(t);
  return d === "down" ? "down" : d === "up" ? "up" : d === "data" ? "data" : "flat";
};

/** "3 min ago", "2 h ago", "yesterday", "8 Nov 2026" */
export function relTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return tr("just now");
  if (s < 3600) return tr("{n} min ago", { n: Math.floor(s / 60) });
  if (s < 86_400) return tr("{n} h ago", { n: Math.floor(s / 3600) });
  if (s < 172_800) return tr("yesterday");
  return new Date(iso).toLocaleDateString(activeLocale(), { day: "numeric", month: "short", year: "numeric" });
}

export const alertTone = (a: Alert) => SEVERITY_PLAIN[a.severity]?.tone ?? "low";
