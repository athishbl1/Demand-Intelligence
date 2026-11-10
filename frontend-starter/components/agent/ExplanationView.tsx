"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldCheck, Sparkles } from "lucide-react";
import { sendFeedback, type Explanation, type FeedbackItem, type FeedbackTag } from "@/lib/agent";
import { ChangeSummary } from "./ChangeSummary";
import { PeriodChart } from "./PeriodChart";
import { ReasonCard } from "./ReasonCard";
import { VersionTabs } from "./VersionTabs";
import { FeedbackPanel } from "./FeedbackPanel";
import { SuggestStrategies } from "@/components/strategy/SuggestStrategies";
import { DriverBreakdown } from "./DriverBreakdown";
import { useLang } from "@/lib/i18n";
import { signedPct } from "./plain";

const emptyFb = (i: number): FeedbackItem => ({ reason_idx: i, vote: null, tags: [], text: "", ignore: false });
const hasCorrection = (f: FeedbackItem) => f.text.trim().length > 0 || f.tags.length > 0 || f.ignore;

/**
 * The agent's answer, top to bottom in the order a manager reads it:
 * the verdict and numbers, the reasons, things to keep in mind, the daily chart, and the feedback loop.
 */
export function ExplanationView({
  e,
  busy,
  onOpen,
  onReanalyse,
  demo,
  hideSeverity,
}: {
  e: Explanation;
  busy: "load" | "regenerate" | null;
  onOpen: (id: number) => void;
  onReanalyse: (feedback: FeedbackItem[], note: string) => Promise<boolean>;
  demo?: boolean;
  /** The alert page already shows the impact in its header. */
  hideSeverity?: boolean;
}) {
  const { t: tt, locale } = useLang();
  const [fb, setFb] = useState<FeedbackItem[]>(() => e.reasons.map((_, i) => emptyFb(i)));
  const [voteError, setVoteError] = useState<string | null>(null);

  // New version or new question: fresh feedback state.
  useEffect(() => {
    setFb(e.reasons.map((_, i) => emptyFb(i)));
    setVoteError(null);
  }, [e.explanation_id, e.reasons]);

  const vote = (i: number, v: 1 | -1) => {
    if (demo) return;
    sendFeedback(e.explanation_id, [{ ...emptyFb(i), vote: v }]).catch((err: unknown) => setVoteError(err instanceof Error ? err.message : String(err)));
  };

  const reanalyse = (note: string, tags: FeedbackTag[]) => {
    const items = fb.filter(hasCorrection).map((f) => ({ ...f, vote: null }));
    if (tags.length) items.push({ reason_idx: null, vote: null, tags, text: "", ignore: false });
    return onReanalyse(items, note);
  };

  const t = e.totals;
  const vsFc = e.primary === "fc";
  // at most 3 reasons; with actuals they all explain actual vs forecast
  const reasons = e.reasons.slice(0, 3);
  const canFeedback = !demo && e.change_type !== "no_change" && e.change_type !== "data_issue";
  const created = e.created_at ? new Date(e.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${busy ? "opacity-60" : ""}`} aria-busy={busy !== null}>
      <ChangeSummary e={e} hideSeverity={hideSeverity}>
        {e.cached && <span className="border border-line px-2 py-1 text-xs font-semibold text-muted">{tt("Saved answer")}</span>}
        {(e.versions?.length ?? 1) > 1 && <span className="border border-line px-2 py-1 text-xs font-semibold text-muted">{tt("Version")} {e.version}</span>}
      </ChangeSummary>

      <VersionTabs e={e} onOpen={onOpen} busy={busy !== null} />

      {/* status notes that replace the reasons */}
      {e.error === "ai_unavailable" && (
        <div className="notice-error text-sm" role="alert">
          <b>{tt("The reasons could not be written right now.")}</b> {tt("The numbers above are correct; they are calculated from the source data, not by AI. Try again in a minute.")}
        </div>
      )}
      {e.change_type === "no_change" && (
        <div className="notice text-sm">
          <b>{tt("Nothing to explain.")}</b> {tt("Stays are within ±5 % of the forecast and of last year, so no reasons were written.")}
        </div>
      )}
      {e.change_type === "data_issue" && (
        <div className="notice text-sm">
          <AlertTriangle className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
          <b>{tt("Check the data first")}.</b> {tt("{a} of {b} days have a forecast of 0 or missing figures, so the gap may not be a real change in demand.", { a: t.red_days, b: t.days })}
        </div>
      )}

      {/* reasons */}
      {reasons.length > 0 && (
        <section id="why" aria-labelledby="why-title" className="flex scroll-mt-24 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">{vsFc ? tt("Why it happened · actual vs forecast") : tt("Why it happened")}</span>
              <h2 id="why-title" className="mt-3 text-2xl sm:text-3xl">
                {reasons.length === 1 ? tt("What drove the change") : tt("{n} things that drove the change", { n: reasons.length })}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {vsFc
                  ? tt("Why actual stays differ from the forecast ({p}). Most important first; open the evidence to see the numbers.", { p: signedPct(t.gap_fc_pct) })
                  : tt("Most important first. Open the evidence to see the numbers behind each reason.")}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 text-xs text-muted sm:items-end">
              {!vsFc && (
                <span className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-[var(--bar-ink)]" aria-hidden="true" />{tt("Already in the forecast")}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-accent" aria-hidden="true" />{tt("Surprise vs forecast")}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                {e.ai ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                {e.ai ? tt("AI-written summary · every number checked against the data") : tt("Rule-based, no AI")}
              </span>
            </div>
          </div>
          <ol className="flex flex-col divide-y divide-[var(--line)] border border-line bg-white shadow-[0_1px_2px_rgb(17_17_17/0.04)]">
            {reasons.map((r, i) => (
              <ReasonCard
                key={`${e.explanation_id}-${r.rank}`}
                reason={r}
                facts={e.facts}
                fb={fb[i] ?? emptyFb(i)}
                onChange={(f) => setFb((x) => x.map((y, j) => (j === i ? f : y)))}
                onVote={(v) => vote(i, v)}
                canFeedback={canFeedback}
              />
            ))}
          </ol>
          {voteError && <p className="notice-error text-sm">{tt("Your vote was not saved")}: {voteError}</p>}
        </section>
      )}

      {e.caveat && (
        <div className="flex items-start gap-3 border-l-[3px] border-slate-900 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p>
            <b className="font-display text-xs uppercase tracking-[0.08em]">{tt("Good to know")} · </b>
            {e.caveat}
          </p>
        </div>
      )}

      {/* reasoning engine: the change split into measured driver effects, observations and ruled-out drivers */}
      {e.drivers && e.change_type !== "data_issue" && (
        <DriverBreakdown d={e.drivers} vsPy={e.vs_py ?? null} vsLastYear={t.days_with_actual > 0 ? { pct: t.gap_py_pct ?? null, label: tt("actual vs last year") } : undefined} observations={e.observations ?? []} ruledOut={e.vs_py?.ruled_out ?? e.ruled_out ?? []} />
      )}

      {/* Phase 3: hand-over from "why" to "what to do" */}
      {!demo && e.explanation_id && e.reasons.length > 0 && e.change_type !== "no_change" && e.change_type !== "data_issue" && (
        <SuggestStrategies explanationId={e.explanation_id} changeType={e.change_type} />
      )}

      {e.series?.length > 0 && (
        <section className="dash-card" aria-labelledby="chart-title">
          <div className="mb-4">
            <h2 id="chart-title" className="dash-h2">{tt("Daily stays around this period")}</h2>
            <p className="dash-sub mt-0.5">{tt("The shaded band is the period you asked about, with three weeks before and after for context.")}</p>
          </div>
          <PeriodChart series={e.series} />
        </section>
      )}

      {canFeedback && (
        <FeedbackPanel versions={e.versions?.length || 1} pending={fb.filter(hasCorrection).length} busy={busy === "regenerate"} onReanalyse={reanalyse} />
      )}

      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {tt("How this was made: all numbers are calculated directly from TVB Paznaun-Ischgl stays, free beds and booking lead time, OpenHolidays (ODbL), Open-Meteo (CC BY 4.0), the TVB event calendar and Contwise. Only the wording of the reasons is written by AI, and every number in it is checked against these facts.")}
          {created && ` ${tt("Version {v} of {n}, created {c}.", { v: e.version, n: e.versions?.length || 1, c: created })}`}
        </span>
      </p>
    </div>
  );
}
