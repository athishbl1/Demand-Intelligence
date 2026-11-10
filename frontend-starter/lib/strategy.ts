/**
 * Campaign Strategist agent (Phase 3): types and calls to the n8n workflow
 * "team-07 · Campaign Strategist" (POST team-07-strategy, one webhook with an `action` field).
 *
 * The target window, launch date, "room to fill", markets, channels and KPIs are computed or checked in n8n;
 * the AI only picks and words at most 3 strategies, and every number in the text is checked against `facts`.
 */
import { callWebhook, WebhookError } from "@/lib/n8n";
import type { ChangeType, Confidence, Fact, Scope } from "@/lib/agent";

export const STRATEGY_WEBHOOK = "team-07-strategy";
export const MAX_STRATEGY_VERSIONS = 5;

export type Mode = "recover" | "capitalise" | "monitor" | "none";
export type Goal = "recover" | "protect" | "shift" | "retain";
export type Level = "low" | "medium" | "high";
export type SetStatus = "open" | "accepted" | "dismissed";

export interface Timing {
  from: string;
  to: string;
  label: string;
  neighbour?: boolean;
  launch_by: string;
  late: boolean;
  ideal_launch: string;
  lead_days: number;
}

export interface Strategy {
  rank?: number;
  type: string;
  title: string;
  goal: Goal;
  addresses: number[];
  markets: string[];
  audience: string;
  timing: Timing;
  channels: string[];
  hook: string;
  message_idea: string;
  kpi: string;
  effort: Level;
  confidence: Confidence;
  evidence_refs: string[];
  why: string;
  edited_by_check?: boolean;
  /** 0-100, computed in n8n from impact, lead time, feasibility and confidence */
  priority?: number;
  scores?: {
    impact: number;
    lead_time: number;
    feasibility: number;
    confidence: number;
    slack_days: number;
    basis: string;
  };
}

export interface CustomStrategy extends Partial<Strategy> {
  from_user: true;
  original: string;
  verdict: "fits" | "risky" | "conflicts";
  warnings: string[];
  timing: Timing;
}

export interface Target extends Timing {
  alignment: string;
  kind: string;
  has_forecast: boolean;
  /** Which gap the campaigns aim at: "fc" forecast gap (|actual vs forecast| > 5 %), "py" gap to last year, "py_forecast" forecast-only period. */
  basis?: "fc" | "py" | "py_forecast" | null;
}

export interface VersionRef {
  id: number;
  version: number;
  change_note: string | null;
  created_at: string;
}

export interface StrategySet {
  set_id: number;
  root_id: number;
  version: number;
  versions: VersionRef[];
  explanation_id: number;
  explanation: {
    id: number;
    scope: Scope;
    change_type: ChangeType;
    headline: string;
    reasons: { rank: number; title: string; kind: "data" | "hypothesis"; confidence: Confidence }[];
  };
  mode: Mode;
  mode_text: string;
  target: Target;
  room: { value: number; label: string } | null;
  headline: string;
  caveat: string;
  strategies: Strategy[];
  custom: CustomStrategy | null;
  facts: Fact[];
  change_note: string | null;
  model: string | null;
  ai: boolean;
  error: string | null;
  status: SetStatus;
  accepted_idx: number | null;
  decided_at?: string | null;
  cached?: boolean;
  created_at: string;
  feedback_summary?: { up: number; down: number; votes?: Record<string, number> };
}

export interface StrategySetSummary {
  set_id: number;
  version: number;
  mode: Mode;
  status: SetStatus;
  accepted_idx: number | null;
  target: Target;
  explanation_id: number;
  scope: Scope;
  change_type: ChangeType;
  headline: string | null;
  count: number;
  titles: string[];
  custom_title: string | null;
  created_at: string;
  decided_at: string | null;
}

export const STRATEGY_TAGS = ["not realistic", "wrong market", "wrong timing", "too vague", "too expensive", "missing idea"] as const;
export type StrategyTag = (typeof STRATEGY_TAGS)[number];

export interface StrategyFeedback {
  strategy_idx: number | null;
  vote: 1 | -1 | 0 | null;
  tags: StrategyTag[];
  text: string;
  ignore: boolean;
}

interface AgentError {
  error: string;
  message?: string;
}

const AI_TIMEOUT = 120_000;

function unwrap<T>(r: T | AgentError): T {
  if (r && typeof r === "object" && "error" in r && (r as AgentError).error && !("strategies" in r)) {
    throw new WebhookError((r as AgentError).message || (r as AgentError).error, STRATEGY_WEBHOOK);
  }
  return r as T;
}

const call = <T>(data: Record<string, unknown>, timeoutMs?: number, signal?: AbortSignal) =>
  callWebhook<T | AgentError>(STRATEGY_WEBHOOK, data, { timeoutMs, signal }).then((r) => unwrap<T>(r));

/** Suggests strategies for a Phase 2 explanation (cached per explanation unless `force`). */
export const strategize = (explanationId: number, force = false, signal?: AbortSignal) =>
  call<StrategySet>({ action: "strategize", explanation_id: explanationId, force }, AI_TIMEOUT, signal);

export const getSet = (setId: number, signal?: AbortSignal) => call<StrategySet>({ action: "get", set_id: setId }, 30_000, signal);

/** The newest strategy set of an explanation, or null if there is none yet. */
export async function findSetForExplanation(explanationId: number, signal?: AbortSignal): Promise<StrategySet | null> {
  try {
    return await call<StrategySet>({ action: "get", explanation_id: explanationId }, 20_000, signal);
  } catch (e) {
    if (e instanceof WebhookError && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export const regenerateSet = (setId: number, feedback: StrategyFeedback[], note: string, signal?: AbortSignal) =>
  call<StrategySet>({ action: "regenerate", set_id: setId, feedback, note: note.slice(0, 500) }, AI_TIMEOUT, signal);

/** The 4th slot: the agent structures and checks the user's own strategy. */
export const checkCustom = (setId: number, text: string, signal?: AbortSignal) =>
  call<StrategySet>({ action: "custom", set_id: setId, text: text.slice(0, 800) }, AI_TIMEOUT, signal);

export const voteStrategy = (setId: number, idx: number, vote: 1 | -1) =>
  call<{ ok: boolean }>({ action: "feedback", set_id: setId, feedback: [{ strategy_idx: idx, vote, tags: [], text: "", ignore: false }] });

/** 0-2 = suggested strategy, 3 = the user's own one. */
export const decide = (setId: number, choice: number | "dismiss" | "reopen") =>
  call<{ ok: boolean; status: SetStatus; accepted_idx: number | null; decided_at: string | null }>({ action: "decide", set_id: setId, choice });

export const listSets = (signal?: AbortSignal) =>
  call<{ sets: StrategySetSummary[]; generated_at: string }>({ action: "list" }, 20_000, signal);

// ---------- plain wording ----------

export const MODE_PLAIN: Record<Mode, { label: string; title: string; text: string }> = {
  recover: {
    label: "Recover",
    title: "Win back the missing guests",
    text: "Stays fell. These strategies aim at the same period next season, or the weak period itself if it is still ahead.",
  },
  capitalise: {
    label: "Capitalise",
    title: "Make the most of strong demand",
    text: "Stays are up. Instead of discounts: protect prices, move extra demand into weaker weeks, and turn guests into rebookings.",
  },
  monitor: { label: "Monitor", title: "No campaign needed", text: "Stays are in line with the forecast and last year." },
  none: { label: "Check data", title: "Fix the data first", text: "The numbers for this period are incomplete, so no campaign is suggested." },
};

export const GOAL_PLAIN: Record<Goal, string> = {
  recover: "Win back demand",
  protect: "Protect value",
  shift: "Shift demand",
  retain: "Keep the guests",
};

export const MARKET_PLAIN: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  CH: "Switzerland",
  DE: "Germany",
  NL: "Netherlands",
  SE: "Sweden",
  UK: "United Kingdom",
};

export const VERDICT_PLAIN: Record<CustomStrategy["verdict"], { label: string; tone: "good" | "warn" | "bad" }> = {
  fits: { label: "Fits the data", tone: "good" },
  risky: { label: "Possible, with risks", tone: "warn" },
  conflicts: { label: "Conflicts with the data", tone: "bad" },
};
