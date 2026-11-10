"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Info, ShieldCheck, X } from "lucide-react";
import { voteStrategy, type StrategyFeedback, type StrategySet, type StrategyTag } from "@/lib/strategy";
import type { StrategyBusy } from "@/lib/useStrategySet";
import { StrategyHeader } from "./StrategyHeader";
import { StrategyCard } from "./StrategyCard";
import { CustomStrategyCard } from "./CustomStrategyCard";
import { ConfirmPlanDialog } from "./ConfirmPlanDialog";
import { StrategyFeedbackPanel } from "./StrategyFeedbackPanel";

const emptyFb = (i: number): StrategyFeedback => ({ strategy_idx: i, vote: null, tags: [], text: "", ignore: false });
const hasCorrection = (f: StrategyFeedback) => f.text.trim().length > 0 || f.tags.length > 0 || f.ignore;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** The strategist's answer: the plan, max. 3 strategies plus "your idea", the decision and the feedback loop. */
export function StrategyView({
  s,
  busy,
  onOpen,
  onReanalyse,
  onCustom,
  onDecide,
}: {
  s: StrategySet;
  busy: StrategyBusy;
  onOpen: (id: number) => void;
  onReanalyse: (fb: StrategyFeedback[], note: string) => Promise<boolean>;
  onCustom: (text: string) => Promise<boolean>;
  onDecide: (choice: number | "dismiss" | "reopen") => Promise<boolean>;
}) {
  const t = useT();
  const router = useRouter();
  /** Plan waiting for the confirmation pop-up (0-2 suggested, 3 = own idea). */
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [fb, setFb] = useState<StrategyFeedback[]>(() => s.strategies.map((_, i) => emptyFb(i)));
  const [voteError, setVoteError] = useState<string | null>(null);
  const [today] = useState(todayIso);

  useEffect(() => {
    setFb(s.strategies.map((_, i) => emptyFb(i)));
    setVoteError(null);
  }, [s.set_id, s.strategies]);

  const canAct = s.mode === "recover" || s.mode === "capitalise";
  const open = s.status !== "dismissed";
  const decided = s.status === "accepted" && s.accepted_idx !== null;
  const titleOf = (i: number) => (i === 3 ? s.custom?.title : s.strategies[i]?.title) ?? "";
  const confirm = async () => {
    if (confirmIdx === null) return;
    if (await onDecide(confirmIdx)) {
      setConfirmIdx(null);
      router.push(`/strategies?confirmed=${s.set_id}`);
    }
  };

  const vote = (i: number, v: 1 | -1) => voteStrategy(s.set_id, i, v).catch((e: unknown) => setVoteError(e instanceof Error ? e.message : String(e)));
  const reanalyse = (note: string, tags: StrategyTag[]) => {
    const items = fb.filter(hasCorrection).map((f) => ({ ...f, vote: null }));
    if (tags.length) items.push({ strategy_idx: null, vote: null, tags, text: "", ignore: false });
    return onReanalyse(items, note);
  };
  const versions = s.versions?.length ? s.versions : [{ id: s.set_id, version: s.version, change_note: s.change_note, created_at: s.created_at }];

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${busy === "load" || busy === "regenerate" ? "opacity-60" : ""}`} aria-busy={busy !== null}>
      <StrategyHeader s={s} today={today} />

      {(versions.length > 1 || s.change_note) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-line bg-slate-50 px-4 py-3">
          <span className="inline-flex items-center gap-2 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-600">
            <History className="h-4 w-4" aria-hidden="true" />
            {t("Versions")}
          </span>
          <div className="seg" role="tablist" aria-label={t("Versions of this plan")}>
            {versions.map((v) => (
              <button key={v.id} type="button" role="tab" className="seg-btn" aria-pressed={v.id === s.set_id} aria-selected={v.id === s.set_id} disabled={busy !== null} onClick={() => v.id !== s.set_id && onOpen(v.id)}>
                v{v.version}
              </button>
            ))}
          </div>
          {s.change_note && <p className="min-w-0 flex-1 text-sm text-slate-600">{t("What changed")}: {s.change_note}</p>}
        </div>
      )}

      {/* decision banner */}
      {s.status === "dismissed" && (
        <div className="notice flex flex-wrap items-center justify-between gap-3 text-sm">
          <span><b>{t("This plan was dismissed.")}</b> {t("No campaign will be prepared from it.")}</span>
          <button type="button" className="btn-ghost !text-xs" onClick={() => onDecide("reopen")}>{t("Reopen")}</button>
        </div>
      )}

      {s.error === "ai_unavailable" && (
        <div className="notice-error text-sm" role="alert">
          <b>{t("The strategies could not be written right now.")}</b> {t("The target window, launch date and room to fill are correct. Try again in a minute.")}
        </div>
      )}
      {!canAct && (
        <div className="notice text-sm">
          <b>{s.mode === "monitor" ? t("No campaign needed.") : t("Fix the data first.")}</b> {s.headline}
        </div>
      )}

      {canAct && (
        <section aria-labelledby="strats-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">{t("What to do")}</span>
              <h2 id="strats-title" className="mt-3 text-2xl sm:text-3xl">
                {s.strategies.length === 3 ? t("Three ideas, or your own") : t("{n} ideas, or your own", { n: s.strategies.length })}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{t("Best option first. Pick one, suggest changes, or add your own idea.")}</p>
            </div>
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
            {s.strategies.map((st, i) => (
              <StrategyCard
                key={`${s.set_id}-${i}`}
                s={st}
                idx={i}
                facts={s.facts}
                today={today}
                fb={fb[i] ?? emptyFb(i)}
                onChange={(f) => setFb((x) => x.map((y, j) => (j === i ? f : y)))}
                onVote={(v) => vote(i, v)}
                chosen={decided && s.accepted_idx === i}
                dimmed={decided && s.accepted_idx !== i}
                onChoose={() => (decided && s.accepted_idx === i ? onDecide("reopen") : setConfirmIdx(i))}
                canAct={open}
                busy={busy !== null}
              />
            ))}
            <CustomStrategyCard
              custom={s.custom}
              today={today}
              busy={busy === "custom"}
              canAct={open}
              chosen={decided && s.accepted_idx === 3}
              dimmed={decided && s.accepted_idx !== 3}
              onCheck={onCustom}
              onChoose={() => (decided && s.accepted_idx === 3 ? onDecide("reopen") : setConfirmIdx(3))}
            />
          </div>
          {voteError && <p className="notice-error text-sm">{t("Your vote was not saved")}: {voteError}</p>}
        </section>
      )}

      {s.caveat && (
        <div className="flex items-start gap-3 border-l-[3px] border-slate-900 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p><b className="font-display text-xs uppercase tracking-[0.08em]">{t("Good to know")} · </b>{s.caveat}</p>
        </div>
      )}

      {canAct && open && (
        <StrategyFeedbackPanel versions={versions.length} pending={fb.filter(hasCorrection).length} busy={busy === "regenerate"} onReanalyse={reanalyse} />
      )}

      {canAct && open && !decided && (
        <div className="flex justify-end">
          <button type="button" className="btn-ghost !text-xs" onClick={() => onDecide("dismiss")} disabled={busy !== null}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Dismiss this plan")}
          </button>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t("How this was made: the target window, launch date and room to fill are computed from TVB stays, forecast and booking lead time, OpenHolidays (ODbL), the TVB event calendar and Contwise. The AI only picks and words the strategies; markets, channels and dates are checked, and sentences with numbers not in the data (for example invented discounts) are removed. No guest data is used.")}
        </span>
      </p>
      {confirmIdx !== null && (
        <ConfirmPlanDialog title={titleOf(confirmIdx)} target={s.target} busy={busy !== null} onConfirm={confirm} onCancel={() => setConfirmIdx(null)} />
      )}
    </div>
  );
}
