"use client";

import { useState, type CSSProperties } from "react";
import { Check, ChevronDown, PencilLine, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Fact } from "@/lib/agent";
import { useT } from "@/lib/i18n";
import { GOAL_PLAIN, STRATEGY_TAGS, type Strategy, type StrategyFeedback, type StrategyTag } from "@/lib/strategy";
import { EvidenceChips, evidenceCount } from "@/components/agent/EvidenceChips";
import { TargetTimeline } from "./TargetTimeline";
import { CARD_GRID, Cell, RatingRow, ToneBadge, WhoWhenHow, rankTone } from "./cardParts";

/**
 * One suggested strategy as a simple card: what to do, who it is for, when to start, and a three-word summary
 * (our rating, effort, confidence). The technical details (channels, scores, evidence) sit behind "More details".
 */
export function StrategyCard({
  s,
  idx,
  facts,
  today,
  fb,
  onChange,
  onVote,
  chosen,
  dimmed,
  onChoose,
  canAct,
  busy,
}: {
  s: Strategy;
  idx: number;
  facts: Fact[];
  today: string;
  fb: StrategyFeedback;
  onChange: (fb: StrategyFeedback) => void;
  onVote: (v: 1 | -1) => void;
  chosen: boolean;
  dimmed: boolean;
  onChoose: () => void;
  canAct: boolean;
  busy: boolean;
}) {
  const t = useT();
  const [more, setMore] = useState(false);
  const [correct, setCorrect] = useState(false);
  const nEv = evidenceCount(s.evidence_refs, facts);
  const tone = rankTone(idx);
  const toggleTag = (tag: StrategyTag) => onChange({ ...fb, tags: fb.tags.includes(tag) ? fb.tags.filter((x) => x !== tag) : [...fb.tags, tag] });

  return (
    <article
      className={`relative mb-4 min-w-0 border bg-white transition-[opacity,box-shadow] duration-300 ${CARD_GRID} ${
        chosen ? "shadow-[var(--shadow-premium)]" : "border-line hover:shadow-[var(--shadow-premium)]"
      } ${dimmed || fb.ignore ? "opacity-55" : ""}`}
      style={{ "--tone": tone.bg, ...(chosen ? { borderColor: tone.bg } : {}) } as CSSProperties}
      aria-labelledby={`strat-${idx}`}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: tone.bg }} aria-hidden="true" />

      {/* 1 · what to do */}
      <Cell className="!pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={tone} />
          <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">{t(GOAL_PLAIN[s.goal])}</span>
        </div>
        <h3 id={`strat-${idx}`} className="mt-3 text-xl !normal-case leading-snug">{s.title}</h3>
        {s.message_idea && <p className="mt-2 text-[15px] italic leading-relaxed text-slate-600">“{s.message_idea}”</p>}
      </Cell>

      {/* 2–4 · who, when, how */}
      <WhoWhenHow s={s} today={today} />

      {/* 5 · rating */}
      <RatingRow effort={s.effort} confidence={s.confidence} priority={s.priority} />

      {/* 6–7 · details on demand */}
      <Cell>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[var(--tone)]"
          aria-expanded={more}
          onClick={() => setMore((o) => !o)}
        >
          {more ? t("Fewer details") : t("More details")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${more ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </Cell>
      <Cell>
        {more && (
          <div className="flex flex-col gap-4 text-sm">
            {s.channels.length > 0 && (
              <p><b className="text-slate-900">{t("Channels")}:</b> <span className="text-slate-600">{s.channels.join(" · ")}</span></p>
            )}
            <p><b className="text-slate-900">{t("How we will know it worked")}:</b> <span className="text-slate-600">{s.kpi}</span></p>
            {s.why && <p><b className="text-slate-900">{t("Why this")}:</b> <span className="text-slate-600">{s.why}</span></p>}
            <TargetTimeline timing={s.timing} today={today} compact />
            {s.scores && (
              <p className="text-xs text-muted">
                {t("The score is calculated, not written by AI.")}{" "}
                {s.scores.slack_days >= 0 ? t("{n} days of room before the ideal start date.", { n: s.scores.slack_days }) : t("The ideal start date has passed.")}
              </p>
            )}
            {nEv > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t("Evidence")} ({nEv})</p>
                <EvidenceChips refs={s.evidence_refs} facts={facts} />
              </div>
            )}
          </div>
        )}
      </Cell>

      {/* 8 · feedback */}
      <Cell className="pb-4">
        {canAct && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <Vote active={fb.vote === 1} label={t("Good idea")} onClick={() => { onChange({ ...fb, vote: 1 }); onVote(1); }}><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /></Vote>
              <Vote active={fb.vote === -1} label={t("Not a good idea")} onClick={() => { onChange({ ...fb, vote: -1 }); onVote(-1); setCorrect(true); }}><ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /></Vote>
              <button type="button" className={`inline-flex items-center gap-1.5 font-semibold hover:text-[var(--tone)] ${correct ? "text-[var(--tone)]" : "text-slate-700"}`} aria-expanded={correct} onClick={() => setCorrect((o) => !o)}>
                <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                {t("Suggest a change")}
              </button>
            </div>
            {correct && (
              <div className="mt-3 flex flex-col gap-2 border-l-2 border-slate-900 pl-3">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("What is wrong")}>
                  {STRATEGY_TAGS.map((tag) => (
                    <button key={tag} type="button" className="seg-btn !normal-case !tracking-normal" aria-pressed={fb.tags.includes(tag)} onClick={() => toggleTag(tag)}>{t(tag)}</button>
                  ))}
                </div>
                <label className="sr-only" htmlFor={`strat-text-${idx}`}>{t("What should change?")}</label>
                <textarea id={`strat-text-${idx}`} className="field !min-h-16 !py-2 !text-sm" maxLength={500} placeholder={t("What should change, or what do you know that the agent does not?")} value={fb.text} onChange={(e) => onChange({ ...fb, text: e.target.value })} />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={fb.ignore} onChange={(e) => onChange({ ...fb, ignore: e.target.checked })} />
                  {t("Replace this strategy in the next version")}
                </label>
              </div>
            )}
          </>
        )}
      </Cell>

      {/* 9 · choose */}
      {canAct ? (
        <button
          type="button"
          onClick={onChoose}
          disabled={busy}
          aria-pressed={chosen}
          className={`flex min-h-14 items-center justify-center gap-2 border-t font-display text-sm font-extrabold uppercase tracking-[0.06em] transition-colors ${
            chosen ? "border-transparent bg-[var(--tone)] text-white" : "border-line text-slate-900 hover:bg-[var(--tone)] hover:text-white"
          }`}
        >
          {chosen ? <><Check className="h-4 w-4" aria-hidden="true" />{t("Chosen")}</> : t("Choose this plan")}
        </button>
      ) : (
        <div />
      )}
    </article>
  );
}

function Vote({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center border transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-line text-slate-600 hover:border-slate-900 hover:text-slate-900"}`}
    >
      {children}
    </button>
  );
}
