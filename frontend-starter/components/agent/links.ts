/**
 * Deep links into the Change Explainer (/explain). The agent explains at most 92 days per question,
 * so longer windows (a whole season) are split into equal parts of at most 92 days.
 */
import { DATA_FROM, DATA_TO } from "@/lib/agent";

export const MAX_RANGE_DAYS = 92;

export interface RangePart {
  from: string;
  to: string;
}

const dayMs = 86_400_000;
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Inclusive number of days from `from` to `to`. */
export const rangeDays = (from: string, to: string) => Math.round((parse(to) - parse(from)) / dayMs) + 1;

/** Keeps a window inside the dates the agent has data for. */
export function clampRange(from: string, to: string): RangePart {
  return { from: from < DATA_FROM ? DATA_FROM : from, to: to > DATA_TO ? DATA_TO : to };
}

/** Splits a window into as few equal parts as possible, each at most 92 days. */
export function splitRange(from: string, to: string, max = MAX_RANGE_DAYS): RangePart[] {
  const total = rangeDays(from, to);
  if (total <= max) return [{ from, to }];
  const n = Math.ceil(total / max);
  const size = Math.ceil(total / n);
  const parts: RangePart[] = [];
  for (let i = 0; i < n; i++) {
    const a = parse(from) + i * size * dayMs;
    const b = Math.min(parse(to), a + (size - 1) * dayMs);
    parts.push({ from: toIso(a), to: toIso(b) });
  }
  return parts;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Window of a season label from the n8n answer, e.g. "Winter 2025/26 (24 Nov - 3 May)" → 2025-11-24 … 2026-05-03.
 * Months from July on belong to the first year, earlier months to the second.
 */
export function seasonWindow(label: string): RangePart | null {
  const m = label.match(/(\d{4})(?:\/(\d{2,4}))?\s*\((\d{1,2})\s+([A-Za-z]{3})[a-z]*\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*\)/);
  if (!m) return null;
  const y1 = Number(m[1]);
  const y2 = m[2] ? (m[2].length === 2 ? Math.floor(y1 / 100) * 100 + Number(m[2]) : Number(m[2])) : y1;
  const date = (d: string, mon: string) => {
    const mm = MONTHS[mon.toLowerCase()];
    if (!mm) return null;
    const y = mm >= 7 ? y1 : y2;
    return `${y}-${String(mm).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
  };
  const from = date(m[3], m[4]);
  const to = date(m[5], m[6]);
  return from && to && from <= to ? clampRange(from, to) : null;
}

/** /explain link for a window; `why` scrolls the answer to the reasons once it has loaded. */
export function explainHref(range: RangePart, compare: "py" | "fc" = "py", why = true): string {
  const p = new URLSearchParams();
  if (range.from === range.to) p.set("date", range.from);
  else {
    p.set("from", range.from);
    p.set("to", range.to);
  }
  if (compare === "fc") p.set("compare", "fc");
  if (why) p.set("why", "1");
  return `/explain?${p.toString()}`;
}
