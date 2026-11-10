"use client";

import { useState } from "react";
import { ChevronDown, FileText, Lightbulb, PencilLine, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { FEEDBACK_TAGS, type Fact, type FeedbackItem, type FeedbackTag, type Reason } from "@/lib/agent";
import { useT } from "@/lib/i18n";
import { EvidenceChips, evidenceCount } from "./EvidenceChips";
import { CONFIDENCE_PLAIN } from "./plain";

/** Which part of the change a reason belongs to, in the colours of the "How the change splits" bar. */
const PART: Record<Reason["explains"], { label: string; swatch: string }> = {
  expected: { label: "Already in the forecast", swatch: "bg-[var(--bar-ink)]" },
  miss: { label: "The surprise vs the forecast", swatch: "bg-accent" },
  both: { label: "The whole change", swatch: "bg-[linear-gradient(90deg,var(--bar-ink)_50%,var(--accent)_50%)]" },
};

/**
 * One reason as a row: number and title, the explanation, and on the right how far to trust it and which
 * part of the change it explains. Evidence and corrections sit on one quiet line and open on demand.
 */
export function ReasonCard({
  reason,
  facts,
  fb,
  onChange,
  onVote,
  canFeedback = true,
}: {
  reason: Reason;
  facts: Fact[];
  fb: FeedbackItem;
  onChange: (fb: FeedbackItem) => void;
  /** Saves a vote right away (no reanalysis). */
  onVote: (vote: 1 | -1) => void;
  canFeedback?: boolean;
}) {
  const t = useT();
  const [evidence, setEvidence] = useState(false);
  const [correct, setCorrect] = useState(false);
  const hyp = reason.kind === "hypothesis";
  const conf = CONFIDENCE_PLAIN[reason.confidence];
  const refs = reason.evidence_refs.filter((r) => r !== "f1.change_type" || !hyp);
  const nEvidence = evidenceCount(refs, facts);
  const part = PART[reason.explains];
  const share = typeof reason.share_pct === "number" && !hyp ? reason.share_pct : null;
  const toggleTag = (t: FeedbackTag) => onChange({ ...fb, tags: fb.tags.includes(t) ? fb.tags.filter((x) => x !== t) : [...fb.tags, t] });

  const coincidence = !!reason.finding_id && /school|weather|event|peers|easter/.test(reason.finding_id);
  return (
    <li className={`bg-white transition-opacity ${fb.ignore ? "opacity-50" : ""}`} aria-labelledby={`reason-${reason.rank}`}>
      <article className="grid gap-x-8 gap-y-4 p-5 sm:p-6 md:grid-cols-[1fr_15rem]">
        {/* left: number, title, text, actions */}
        <div className="flex min-w-0 gap-4">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center font-display text-base font-black ${
              reason.rank === 1 ? "bg-accent text-white" : "border-2 border-slate-900 text-slate-900"
            }`}
            aria-hidden="true"
          >
            {reason.rank}
          </span>
          <div className="min-w-0 flex-1">
            <h3 id={`reason-${reason.rank}`} className="text-lg !normal-case leading-snug">
              {reason.title}
            </h3>
            {reason.text && <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-slate-700">{reason.text}</p>}

            {(nEvidence > 0 || canFeedback) && (
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {nEvidence > 0 && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-accent"
                    aria-expanded={evidence}
                    aria-controls={`reason-ev-${reason.rank}`}
                    onClick={() => setEvidence((o) => !o)}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {evidence ? t("Hide evidence") : t("Show evidence")} ({nEvidence})
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${evidence ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                )}
                {canFeedback && (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <span className="mr-1 hidden sm:inline">{t("Helpful?")}</span>
                    <VoteButton active={fb.vote === 1} label={t("Helpful")} onClick={() => { onChange({ ...fb, vote: 1 }); onVote(1); }}>
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </VoteButton>
                    <VoteButton active={fb.vote === -1} label={t("Not helpful")} onClick={() => { onChange({ ...fb, vote: -1 }); onVote(-1); setCorrect(true); }}>
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </VoteButton>
                    <button
                      type="button"
                      className={`ml-2 inline-flex items-center gap-1.5 font-semibold hover:text-accent ${correct ? "text-accent" : "text-slate-700"}`}
                      aria-expanded={correct}
                      aria-controls={`reason-fb-${reason.rank}`}
                      onClick={() => setCorrect((o) => !o)}
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("Correct this")}
                    </button>
                  </span>
                )}
              </div>
            )}

            {evidence && (
              <div id={`reason-ev-${reason.rank}`} className="mt-3 max-w-2xl">
                <EvidenceChips refs={refs} facts={facts} />
              </div>
            )}

            {canFeedback && correct && (
              <div id={`reason-fb-${reason.rank}`} className="mt-3 flex max-w-2xl flex-col gap-2 border-l-2 border-slate-900 pl-4">
                <p className="text-xs font-semibold">{t("What is wrong with this reason?")}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("What is wrong")}>
                  {FEEDBACK_TAGS.map((tag) => (
                    <button key={tag} type="button" className="seg-btn !normal-case !tracking-normal" aria-pressed={fb.tags.includes(tag)} onClick={() => toggleTag(tag)}>
                      {t(tag)}
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor={`reason-text-${reason.rank}`}>{t("Why is this reason wrong?")}</label>
                <textarea
                  id={`reason-text-${reason.rank}`}
                  className="field !min-h-20 !py-2 !text-sm"
                  maxLength={500}
                  placeholder={t("Tell the agent what it got wrong or missed.")}
                  value={fb.text}
                  onChange={(e) => onChange({ ...fb, text: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={fb.ignore} onChange={(e) => onChange({ ...fb, ignore: e.target.checked })} />
                  {t("Leave this reason out of the next version")}
                </label>
                <p className="text-[11px] text-muted">{t("Sent together with “Reanalyse” below.")}</p>
              </div>
            )}
          </div>
        </div>

        {/* right: trust and coverage */}
        <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs sm:text-sm md:flex md:flex-col md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <dt className="kpi-label">{t("Evidence")}</dt>
            <dd className="mt-1">
              {hyp ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  {t("Possible cause, worth checking")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--delta-good)]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {coincidence ? t("Matches the data") : t("Backed by data")}
                </span>
              )}
              {!hyp && (
                <span className="mt-1 block text-[11px] font-normal text-muted">
                  {coincidence
                    ? t("Timing matches, but the effect is not measured: one prior year, no split by market.")
                    : t("Worked out from the numbers.")}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="kpi-label">{t("Confidence")}</dt>
            <dd className="mt-1 flex items-center gap-2 font-semibold">
              <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3].map((d) => (
                  <span key={d} className={`h-2 w-4 ${d <= conf.dots ? "bg-slate-900" : "bg-slate-200"}`} />
                ))}
              </span>
              {t(conf.label.replace(" confidence", ""))}
            </dd>
          </div>
          {!hyp && (
            <div>
              <dt className="kpi-label">{t("Explains")}</dt>
              <dd className="mt-1 flex items-start gap-2">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 ${part.swatch}`} aria-hidden="true" />
                <span>
                  <span className="font-semibold">{t(part.label)}</span>
                  {share !== null && <span className="block text-xs text-muted tabular-nums">{t("{n} % of the change", { n: share })}</span>}
                </span>
              </dd>
            </div>
          )}
          {reason.from_feedback && <p className="text-xs font-semibold text-accent">{t("Added from your feedback")}</p>}
        </dl>
      </article>
    </li>
  );
}

function VoteButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center border transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-line text-slate-600 hover:border-slate-900 hover:text-slate-900"}`}
    >
      {children}
    </button>
  );
}
