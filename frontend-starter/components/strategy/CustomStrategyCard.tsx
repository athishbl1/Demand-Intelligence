"use client";

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Check, ChevronDown, CircleCheck, Lightbulb } from "lucide-react";
import { useT } from "@/lib/i18n";
import { VERDICT_PLAIN, type CustomStrategy } from "@/lib/strategy";
import { CARD_GRID, CUSTOM_TONE, Cell, RatingRow, ToneBadge, WhoWhenHow } from "./cardParts";

const TONE = { good: "var(--delta-good)", warn: "#f59e0b", bad: "var(--delta-bad)" } as const;

/**
 * The 4th slot: the user writes their own strategy, the agent structures it and checks it against the data
 * (holiday dates per market, launch deadline). It has the same rows as the suggested cards (Who, When, How,
 * rating, buttons) so everything lines up, and no timeline. The user's idea is kept; the agent never replaces it.
 */
export function CustomStrategyCard({
  custom,
  today,
  busy,
  canAct,
  chosen,
  dimmed,
  onCheck,
  onChoose,
}: {
  custom: CustomStrategy | null;
  today: string;
  busy: boolean;
  canAct: boolean;
  chosen: boolean;
  dimmed: boolean;
  onCheck: (text: string) => Promise<boolean>;
  onChoose: () => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(!custom);
  const [more, setMore] = useState(false);
  const v = custom ? VERDICT_PLAIN[custom.verdict] : null;
  const tone = CUSTOM_TONE;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (text.trim().length < 10 || busy) return;
    if (await onCheck(text.trim())) {
      setText("");
      setEditing(false);
    }
  };

  const showForm = canAct && editing;

  return (
    <article
      className={`relative mb-4 min-w-0 border bg-white transition-opacity ${CARD_GRID} ${chosen ? "shadow-[var(--shadow-premium)]" : "border-dashed border-slate-300"} ${dimmed ? "opacity-55" : ""}`}
      style={{ "--tone": tone.bg, ...(chosen ? { borderColor: tone.bg } : {}) } as CSSProperties}
      aria-labelledby="strat-custom"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: tone.bg }} aria-hidden="true" />

      {/* 1 · header (the form below replaces it and spans the whole card) */}
      {!showForm && <Cell className="!pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={tone} />
          {v && !showForm && (
            <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: TONE[v.tone] }}>
              {v.tone === "good" ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
              {t(v.label)}
            </span>
          )}
        </div>
        <h3 id="strat-custom" className="mt-3 text-xl !normal-case leading-snug">{custom?.title ?? t("Add your own strategy")}</h3>
        {custom && !editing && custom.message_idea && <p className="mt-2 text-[15px] italic leading-relaxed text-slate-600">“{custom.message_idea}”</p>}
      </Cell>}

      {showForm ? (
        <Cell className="pb-5 !pt-6 [grid-row:span_9]">
          <form className="flex h-full flex-col gap-3" onSubmit={submit}>
            <div className="flex flex-wrap items-center gap-2"><ToneBadge tone={tone} /></div>
            <h3 id="strat-custom" className="flex items-start gap-2 text-xl !normal-case leading-snug">
              <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              {t("Add your own strategy")}
            </h3>
            <p className="text-sm text-slate-600">
              {t("None of the three fits? Describe your own campaign in a sentence or two. The agent turns it into the same plan format and checks it against holidays, events and booking habits.")}
            </p>
            <label className="sr-only" htmlFor="custom-text">{t("Your strategy")}</label>
            <textarea
              id="custom-text"
              className="field min-h-32 flex-1 !py-2 !text-sm"
              maxLength={800}
              placeholder={t("e.g. A ski & spa week for Dutch families after Easter, sold through Dutch tour operators.")}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-muted">
                {text.trim().length < 10 ? t("{n} more characters needed", { n: 10 - text.trim().length }) : `${text.length}/800`}
              </span>
              <span className="flex gap-2">
                {custom && <button type="button" className="btn-ghost !text-xs" onClick={() => setEditing(false)}>{t("Cancel")}</button>}
                <button type="submit" className="btn-secondary !min-h-10 !text-xs" disabled={busy || text.trim().length < 10}>
                  {busy ? <span className="spinner" aria-hidden="true" /> : null}
                  {busy ? t("Checking …") : t("Check my idea")}
                </button>
              </span>
            </div>
          </form>
        </Cell>
      ) : custom ? (
        <>
          {/* 2–4 · who, when, how */}
          <WhoWhenHow
            s={{ audience: custom.audience ?? "", markets: custom.markets ?? [], timing: custom.timing, hook: custom.hook ?? "" }}
            today={today}
          />

          {/* 5 · rating (computed in n8n for your own idea too) */}
          <RatingRow effort={custom.effort} confidence={custom.confidence} priority={custom.priority} />

          {/* 6–7 · details */}
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
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-slate-600"><b className="text-slate-900">{t("You wrote")}:</b> “{custom.original}”</p>
                {custom.warnings.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {custom.warnings.map((w) => (
                      <li key={w} className="flex items-start gap-2 border-l-[3px] border-amber-500 bg-slate-50 px-3 py-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {(custom.channels?.length ?? 0) > 0 && (
                  <p><b className="text-slate-900">{t("Channels")}:</b> <span className="text-slate-600">{custom.channels!.join(" · ")}</span></p>
                )}
                {custom.kpi && <p><b className="text-slate-900">{t("How we will know it worked")}:</b> <span className="text-slate-600">{custom.kpi}</span></p>}
                {custom.why && <p><b className="text-slate-900">{t("Why this")}:</b> <span className="text-slate-600">{custom.why}</span></p>}
              </div>
            )}
          </Cell>

          {/* 8 · edit */}
          <Cell className="pb-4">
            {canAct && (
              <button type="button" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:text-[var(--tone)] hover:underline" onClick={() => setEditing(true)}>
                {t("Write a different idea")}
              </button>
            )}
          </Cell>
        </>
      ) : null}

      {/* 9 · choose (not rendered while the form fills the card) */}
      {showForm ? null : canAct && custom && !editing ? (
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
