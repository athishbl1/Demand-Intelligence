/**
 * Live demo feed (temporary, for testing the alert → explanation → campaign flow).
 *
 * The n8n workflow "team-07 · Demo" is triggered by a person (GET team-07-demo-push?scenario=drop|rise|normal).
 * It creates a DUMMY actual guest-night count for one day, correlated to that day's forecast, and holds it as
 * ONE pending record. The app polls GET team-07-demo-actual, which hands the record over once. The app compares
 * the actual with the forecast and raises an alert. The actual is NEVER written to the database and lives in
 * memory only (module state below), so a page refresh loses it.
 *
 * Opening the alert asks the agent for the explanation with `demo: true`, which tells n8n not to save
 * the report and not to raise a second (database) alert. The campaign plan then runs on that explanation.
 */
import { callWebhook } from "@/lib/n8n";
import type { Alert, Explanation } from "@/lib/agent";

export const DEMO_FEED = "team-07-demo-actual";
export const DEMO_ALERT_TYPE = "demo_actual";
/** Deviation of the actual from the forecast (in %) from which the demo raises an alert. */
export const DEMO_THRESHOLD_PCT = 10;
export const DEMO_CHANGED = "team07:demo-changed";

export interface DemoRecord {
  ok: boolean;
  demo: true;
  pending?: boolean;
  date: string;
  real_today: string;
  shifted: boolean;
  forecast: number;
  previous_year: number | null;
  actual: number;
  deviation_pct: number | null;
  scenario: "drop" | "rise" | "normal";
  pct: number;
  pushed_at: string;
}

// Memory only (module state): shared by all components, gone after a page refresh.
let record: DemoRecord | null = null;
let alert: Alert | null = null;

const changed = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_CHANGED));
};

export const isDemoAlert = (a: { id: number }) => a.id < 0;
export const currentDemoRecord = () => record;
export const getDemoAlert = (): Alert | null => alert;

export function setDemoAlertStatus(status: "read" | "dismissed" | "unread") {
  if (alert) {
    alert = { ...alert, status };
    changed();
  }
}

const fmt = (n: number) => n.toLocaleString("en-GB");

function buildAlert(r: DemoRecord): Alert | null {
  const dev = r.deviation_pct;
  if (dev === null || Math.abs(dev) < DEMO_THRESHOLD_PCT) return null;
  const down = dev < 0;
  const day = new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return {
    id: -((Date.parse(r.pushed_at) % 1_000_000_000) + 1),
    explanation_id: null,
    date: r.date,
    scope_label: day,
    change_type: down ? "forecast_too_high" : "forecast_too_low",
    delta_pct: dev,
    severity: Math.abs(dev) >= 25 ? "high" : "medium",
    headline: `Demo: ${fmt(r.actual)} guest nights reported for ${day}, ${down ? "below" : "above"} the forecast of ${fmt(r.forecast)} (${dev > 0 ? "+" : ""}${dev} %).`,
    status: "unread",
    created_at: r.pushed_at,
    alert_type: DEMO_ALERT_TYPE,
    detail: { metric: "vs forecast", from: r.date, to: r.date, threshold: DEMO_THRESHOLD_PCT, actual: r.actual, forecast: r.forecast },
  };
}

/**
 * Asks the n8n feed whether the demo workflow was triggered. n8n hands a dummy count over once.
 * A count that deviates from the forecast by DEMO_THRESHOLD_PCT or more becomes an alert. Errors change nothing.
 */
export async function syncDemoFeed(signal?: AbortSignal): Promise<Alert | null> {
  try {
    const r = await callWebhook<DemoRecord | { ok: boolean; pending?: false }>(DEMO_FEED, undefined, { method: "GET", timeoutMs: 15_000, signal });
    if (r && "actual" in r && r.ok && r.pending) {
      record = r;
      alert = buildAlert(r);
      changed();
    }
  } catch {
    /* n8n unreachable: keep what we have */
  }
  return alert;
}

/** Explanation for the demo alert. `demo: true` keeps the dummy actual out of the database and raises no database alert. */
export async function explainDemo(r: DemoRecord, signal?: AbortSignal): Promise<Explanation> {
  const res = await callWebhook<Explanation | { error: string; message?: string }>(
    "team-07-agent",
    { action: "report", demo: true, date: r.date, actual: r.actual, forecast: r.forecast },
    { timeoutMs: 90_000, signal },
  );
  if (res && typeof res === "object" && "error" in res && res.error && !("reasons" in res)) {
    throw new Error((res as { message?: string }).message || res.error);
  }
  return res as Explanation;
}
