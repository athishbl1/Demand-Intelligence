/**
 * Change Explainer agent (AGENT_PLAN.md): types and calls to the n8n workflow
 * "team-07 · Drop Watch & Investigate" (POST team-07-agent, one webhook with an `action` field).
 *
 * Numbers come from SQL/Code in n8n; only the wording of the reasons is written by the AI and every
 * number in it is checked against `facts` before it reaches the app.
 */
import { callWebhook, WebhookError } from "@/lib/n8n";
import { setDemoAlertStatus } from "@/lib/demo";

export const AGENT_WEBHOOK = "team-07-agent";
export const DEMO_EXPLANATION = "/demo/explain-2026-W16.json";

export type ChangeType =
  | "real_drop"
  | "real_rise"
  | "expected_drop"
  | "expected_rise"
  | "forecast_too_high"
  | "forecast_too_low"
  | "forecast_drop"
  | "forecast_rise"
  | "no_change"
  | "data_issue";

export type Severity = "high" | "medium" | "info" | "warning" | null;
export type Confidence = "high" | "medium" | "low";
export type ScopeKind = "day" | "week" | "range";

export interface Scope {
  kind: ScopeKind;
  label: string;
  from: string;
  to: string;
  compare: "py" | "fc";
}

export interface Totals {
  days: number;
  days_with_actual: number;
  actual: number | null;
  forecast: number;
  previous_year: number;
  forecast_cmp: number;
  previous_year_cmp: number;
  red_days: number;
  yellow_days: number;
  gap_fc?: number;
  gap_py?: number;
  gap_fc_pct?: number | null;
  gap_py_pct?: number | null;
  fc_vs_py: number;
  fc_vs_py_pct: number | null;
}

export interface Fact {
  id: string;
  label: string;
  now: string | number | null;
  ref: string | number | null;
  source: string;
  note?: string;
}

export interface Reason {
  rank: number;
  kind: "data" | "hypothesis";
  title: string;
  text: string;
  evidence_refs: string[];
  explains: "expected" | "miss" | "both";
  confidence: Confidence;
  from_feedback: boolean;
  edited_by_check: boolean;
  share_pct?: number;
  /** The ranked finding this reason presents (computed in n8n); null for a hypothesis. */
  finding_id?: string | null;
  finding_rank?: number | null;
  /** share of the change x strength of the signal x reliability of the source (0-1). */
  score?: number | null;
  /** false for findings that locate the change (days, peers) but do not explain its cause. */
  covers?: boolean;
  /** "n8n" when the AI skipped the finding and the computed text is shown. */
  worded_by?: "ai" | "n8n";
  /** Which comparison the reason explains: "fc" actual vs forecast (logic "drivers-v5" on), "py" against last year. */
  vs?: "fc" | "py" | null;
}

/** Candidate reason computed and ranked in n8n ("Build facts"); the top ones become the reasons. */
export interface Finding {
  rank: number | null;
  finding_id: string;
  title: string;
  statement: string;
  explains: "expected" | "miss" | "both";
  direction: "up" | "down";
  share_pct: number;
  strength: number;
  reliability: number;
  score: number;
  confidence: Confidence;
  covers: boolean;
  evidence_refs: string[];
  suggested: boolean;
  status: "selected" | "ranked" | "too_weak" | "weaker_in_group" | "rejected";
}

export interface SeriesPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
  previous_year: number | null;
  in_period: boolean;
}

export interface VersionRef {
  id: number;
  version: number;
  change_note: string | null;
  created_at: string;
}

export interface DriverGroup {
  group: string;
  label: string;
  role: "cause" | "trend";
  stays: number;
  ci: [number, number];
  significant: boolean;
  pct_of_gap: number | null;
  sub: { key: string; label: string; stays: number }[];
}

export interface DriverBreakdown {
  version: string;
  basis: "actual" | "forecast";
  coefficients: string;
  comparison: string;
  days: number;
  ya: number;
  yb: number;
  gap: number;
  gap_pct: number | null;
  explained: number;
  residual: number;
  unexplained_pct: number | null;
  calendar_gap?: number;
  weekday_shift?: number;
  groups: DriverGroup[];
  backtest_mape_month: number | null;
  backtest_mape: number | null;
  forecast_noise: { p50: number; p80: number; n: number } | null;
  miss_is_noise?: boolean;
  threshold: number;
}

export interface Observation {
  kind: "noise" | "what_we_see" | "where" | "context" | "data";
  finding_id: string;
  title: string;
  statement: string;
  evidence_refs: string[];
  direction: "up" | "down";
}

export interface RuledOut {
  group: string;
  label: string;
  stays: number | null;
  why: string;
}

/** Actual vs last year (logic "drivers-v5" on): one main measured cause, the rest, and what had no effect. */
export interface VsLastYear {
  pct: number | null;
  /** Stays against the same date last year. */
  gap: number;
  main_point: {
    finding_id: string;
    group: string;
    label: string;
    title: string;
    statement: string;
    stays: number;
    ci: [number, number] | null;
    confidence: Confidence;
    evidence_refs: string[];
  } | null;
  /** Other measured causes (weekday shift and significant drivers) besides the main point. */
  other_measured: number;
  unexplained: number;
  unexplained_pct: number | null;
  ruled_out: RuledOut[];
  note: string | null;
  note_by?: "ai" | "n8n";
}

export interface Explanation {
  explanation_id: number;
  /** "fc": the reasons explain actual vs forecast; "py": forecast-only period, reasons explain forecast vs last year. */
  primary?: "fc" | "py" | null;
  vs_py?: VsLastYear | null;
  root_id: number;
  version: number;
  versions: VersionRef[];
  scope: Scope;
  totals: Totals;
  parts: { expected?: { value: number; share_pct: number }; miss?: { value: number; share_pct: number } };
  change_type: ChangeType;
  change_text: string;
  severity: Severity;
  headline: string;
  caveat: string;
  reasons: Reason[];
  unexplained_pct: number | null;
  /** All findings with rank, score and status (answers from logic "findings-v1" on). */
  findings?: Finding[];
  logic?: string | null;
  /** Driver model attribution (logic "drivers-v2" on): the change vs the same weekdays last year, split into drivers. */
  drivers?: DriverBreakdown | null;
  /** Bookings, free beds, where the gap fell, forecast noise and data flags: shown, never counted as reasons. */
  observations?: Observation[];
  /** Drivers that were checked and showed no real or no certain effect. */
  ruled_out?: RuledOut[];
  facts: Fact[];
  series: SeriesPoint[];
  change_note: string | null;
  model: string | null;
  ai: boolean;
  error: string | null;
  cached?: boolean;
  created_at: string;
  alert_id?: number | null;
  feedback_summary?: { up: number; down: number; notes: number };
}

export interface FeedbackItem {
  reason_idx: number | null;
  vote: 1 | -1 | 0 | null;
  tags: FeedbackTag[];
  text: string;
  ignore: boolean;
}

export const FEEDBACK_TAGS = ["wrong cause", "wrong number", "too vague", "missing context"] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export interface Alert {
  id: number;
  explanation_id: number | null;
  date: string;
  scope_label: string | null;
  change_type: ChangeType;
  delta_pct: number | null;
  severity: "high" | "medium" | "info" | "warning";
  headline: string | null;
  status: "unread" | "read" | "dismissed";
  created_at: string;
  /** Set when the alert was raised by one of the director's alert rules (null for AI-explained report alerts). */
  rule_id?: number | null;
  /** A RuleType for current rules; older alerts may carry types that no longer exist. */
  alert_type?: string | null;
  detail?: AlertDetail | null;
}

/** Numbers behind a rule alert, computed in SQL by n8n ("Check rules"). */
export interface AlertDetail {
  metric: string;
  from: string;
  to: string;
  threshold: number;
  actual?: number;
  forecast?: number;
  bookings?: number;
  reference?: number;
  /** Coming-week alerts: last day to start a campaign so it reaches the guests who book early. */
  act_by?: string | null;
  days_left?: number;
  /** Half of all bookings come at least this many days ahead (from the lead-time data). */
  lead_days?: number;
  /** Share of bookings that usually still comes in with the days left. */
  reachable_pct?: number;
  /** Source markets with school holidays in that week. */
  markets?: string[] | null;
}

// ---------- alert rules: what the director subscribes to (forward-looking only, so every alert leads to an action) ----------

export type RuleType = "forecast_below_py" | "slow_bookings" | "data_gap";

export interface RuleTypeInfo {
  label: string;
  /** One sentence that says when the alert fires, with {t} for the threshold. */
  when: string;
  /** What the director does when it fires. */
  action: string;
  unit: "%" | "days";
  defaultThreshold: number;
  max: number;
}

/** The dropdown. Evaluation lives in n8n (workflows/agent-sql/check_rules.sql); keep both in step. */
export const RULE_TYPES: Record<RuleType, RuleTypeInfo> = {
  forecast_below_py: {
    label: "A coming week looks weak",
    when: "The forecast for a coming week of this winter is {t} % or more below last year.",
    action: "Start a campaign for that week before the act-by date, aimed at the markets on school holiday.",
    unit: "%", defaultThreshold: 8, max: 100,
  },
  slow_bookings: {
    label: "Bookings slowing down",
    when: "New bookings in the latest week fall {t} % or more below the 4-week average.",
    action: "Check prices and push offers for the coming weeks.",
    unit: "%", defaultThreshold: 20, max: 100,
  },
  data_gap: {
    label: "Forecast missing",
    when: "{t} or more of the next 56 days have no forecast although last year had guests.",
    action: "Ask for an updated forecast before planning campaigns.",
    unit: "days", defaultThreshold: 3, max: 56,
  },
};

export const RULE_TYPE_IDS = Object.keys(RULE_TYPES) as RuleType[];

/** Rule info, or null for alert types that no longer exist (old, dismissed alerts). */
export const ruleInfo = (t: string | null | undefined): RuleTypeInfo | null => (t && t in RULE_TYPES ? RULE_TYPES[t as RuleType] : null);

export interface RulePeriod {
  date: string;
  label: string;
  value: number;
  fire: boolean;
  act_by?: string | null;
}

export interface AlertRule {
  id: number;
  type: RuleType;
  threshold: number;
  label: string | null;
  enabled: boolean;
  created_at: string;
  last_checked_at: string | null;
  last_result: { hits: number; as_of?: string; periods: RulePeriod[] } | null;
  alerts_open: number;
}

export interface RulesState {
  ok: boolean;
  rules: AlertRule[];
  new_alerts: number;
  unread: number;
  as_of_date: string | null;
  lead_days?: number;
  checked_at: string;
}

export interface AlertList {
  alerts: Alert[];
  unread: number;
  as_of_date: string | null;
  generated_at: string;
}

/** Errors the workflow answers with 200 (limit reached, not found) or 400 (bad request). */
interface AgentError {
  error: string;
  message?: string;
}

export const MAX_VERSIONS = 5;

/** Explaining with the AI can take a few seconds; reanalysis a bit longer. */
const AI_TIMEOUT = 90_000;

function unwrap<T>(r: T | AgentError, path = AGENT_WEBHOOK): T {
  if (r && typeof r === "object" && "error" in r && (r as AgentError).error && !("reasons" in r)) {
    throw new WebhookError((r as AgentError).message || (r as AgentError).error, path);
  }
  return r as T;
}

export type ExplainQuery =
  | { scope: "day"; date: string; compare?: "py" | "fc" }
  | { scope: "week"; week: string; compare?: "py" | "fc" }
  | { scope: "range"; from: string; to: string; compare?: "py" | "fc" };

export async function explain(q: ExplainQuery, opts: { force?: boolean; signal?: AbortSignal } = {}) {
  const r = await callWebhook<Explanation | AgentError>(
    AGENT_WEBHOOK,
    { action: "explain", ...q, force: opts.force === true },
    { timeoutMs: AI_TIMEOUT, signal: opts.signal },
  );
  return unwrap<Explanation>(r);
}

export async function getExplanation(id: number, signal?: AbortSignal) {
  const r = await callWebhook<Explanation | AgentError>(AGENT_WEBHOOK, { action: "get", explanation_id: id }, { signal });
  return unwrap<Explanation>(r);
}

export async function regenerate(id: number, feedback: FeedbackItem[], note: string, signal?: AbortSignal) {
  const r = await callWebhook<Explanation | AgentError>(
    AGENT_WEBHOOK,
    { action: "regenerate", explanation_id: id, feedback, note: note.slice(0, 500) },
    { timeoutMs: AI_TIMEOUT, signal },
  );
  return unwrap<Explanation>(r);
}

export async function sendFeedback(id: number, feedback: FeedbackItem[]) {
  return unwrap<{ ok: boolean; saved: number }>(
    await callWebhook<{ ok: boolean; saved: number } | AgentError>(AGENT_WEBHOOK, { action: "feedback", explanation_id: id, feedback }),
  );
}

export async function listAlerts(status: "open" | "unread" | "read" | "dismissed" = "open", signal?: AbortSignal) {
  return unwrap<AlertList>(await callWebhook<AlertList | AgentError>(AGENT_WEBHOOK, { action: "alerts", status }, { signal, timeoutMs: 20_000 }));
}

export async function setAlertStatus(id: number, status: "read" | "dismissed" | "unread") {
  if (id < 0) {
    // demo alert: lives in the browser only
    setDemoAlertStatus(status);
    notifyAlertsChanged();
    return { ok: true, unread: 0 };
  }
  const r = unwrap<{ ok: boolean; unread: number }>(
    await callWebhook<{ ok: boolean; unread: number } | AgentError>(AGENT_WEBHOOK, { action: "alert_status", id, status }),
  );
  notifyAlertsChanged();
  return r;
}

/** Demo button: sends the as-of day (team_07_settings) as today's report; may raise an alert. */
export async function runCheckNow(report?: { date: string; actual?: number }) {
  const r = await callWebhook<Explanation | AgentError>(AGENT_WEBHOOK, { action: "report", ...(report ?? {}) }, { timeoutMs: AI_TIMEOUT });
  const e = unwrap<Explanation>(r);
  notifyAlertsChanged();
  return e;
}

/** Lists the rules. n8n also checks them right away, so new hits show up as alerts. */
export async function listRules(signal?: AbortSignal) {
  const r = unwrap<RulesState>(await callWebhook<RulesState | AgentError>(AGENT_WEBHOOK, { action: "rules" }, { signal, timeoutMs: 20_000 }));
  if (r.new_alerts > 0) notifyAlertsChanged();
  return r;
}

/** Adds a rule (no id) or changes one; n8n checks all rules afterwards. */
export async function saveRule(rule: { rule_id?: number; type?: RuleType; threshold?: number; label?: string; enabled?: boolean }) {
  const r = unwrap<RulesState>(await callWebhook<RulesState | AgentError>(AGENT_WEBHOOK, { action: "rule_save", ...rule }, { timeoutMs: 20_000 }));
  notifyAlertsChanged();
  return r;
}

export async function deleteRule(id: number) {
  const r = unwrap<RulesState>(await callWebhook<RulesState | AgentError>(AGENT_WEBHOOK, { action: "rule_delete", rule_id: id }, { timeoutMs: 20_000 }));
  notifyAlertsChanged();
  return r;
}

/** Same check the hourly schedule runs. */
export async function checkRules() {
  const r = unwrap<RulesState>(await callWebhook<RulesState | AgentError>(AGENT_WEBHOOK, { action: "check" }, { timeoutMs: 20_000 }));
  notifyAlertsChanged();
  return r;
}

/** Saved real answer (2026-W16) so the page still shows something when n8n is unreachable. */
export async function loadDemoExplanation(): Promise<Explanation> {
  const res = await fetch(DEMO_EXPLANATION, { cache: "no-store" });
  if (!res.ok) throw new Error("The demo snapshot is missing.");
  return (await res.json()) as Explanation;
}

/** Lets the bell refresh right after the inbox changed something. */
export const ALERTS_CHANGED = "team07:alerts-changed";
export function notifyAlertsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ALERTS_CHANGED));
}

// ---------- labels used by several components ----------

export const CHANGE_LABEL: Record<ChangeType, string> = {
  real_drop: "Real drop",
  real_rise: "Real rise",
  expected_drop: "Expected drop",
  expected_rise: "Expected rise",
  forecast_too_high: "Forecast too high",
  forecast_too_low: "Forecast too low",
  forecast_drop: "Forecast below last year",
  forecast_rise: "Forecast above last year",
  no_change: "No real change",
  data_issue: "Data issue",
};

export function direction(t: ChangeType): "down" | "up" | "flat" | "data" {
  if (t === "data_issue") return "data";
  if (t === "no_change") return "flat";
  return /drop|too_high/.test(t) ? "down" : "up";
}

export const SEVERITY_BADGE: Record<string, string> = {
  high: "badge-red",
  medium: "badge-yellow",
  warning: "badge-yellow",
  info: "badge-green",
};

export const CONFIDENCE_BADGE: Record<Confidence, string> = {
  high: "badge-green",
  medium: "badge-yellow",
  low: "badge-gray",
};

/** ISO week (2026-W16) of a YYYY-MM-DD date. */
export function isoWeekOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const DATA_FROM = "2025-11-04";
export const DATA_TO = "2027-04-04";
export const ACTUALS_END = "2026-10-31";
