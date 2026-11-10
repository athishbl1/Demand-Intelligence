"use client";

import { useT } from "@/lib/i18n";
import { useState } from "react";
import { MessageSquarePlus, RotateCcw } from "lucide-react";
import { MAX_STRATEGY_VERSIONS, STRATEGY_TAGS, type StrategyTag } from "@/lib/strategy";

/**
 * "Not quite right?" A note and tags for the whole set; the parent adds the per-card corrections and sends everything
 * with Reanalyse, the one crimson button of this page.
 */
export function StrategyFeedbackPanel({
  versions,
  pending,
  busy,
  onReanalyse,
}: {
  versions: number;
  pending: number;
  busy: boolean;
  onReanalyse: (note: string, tags: StrategyTag[]) => Promise<boolean>;
}) {
  const t = useT();
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<StrategyTag[]>([]);
  const left = Math.max(0, MAX_STRATEGY_VERSIONS - versions);
  const canSend = left > 0 && !busy && (note.trim().length > 0 || tags.length > 0 || pending > 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canSend) return;
    if (await onReanalyse(note.trim(), tags)) {
      setNote("");
      setTags([]);
    }
  };

  return (
    <form className="grid gap-6 border border-line bg-white p-5 sm:p-7 lg:grid-cols-[0.8fr_1.2fr]" onSubmit={submit} aria-labelledby="sfb-title">
      <div>
        <span className="flex h-10 w-10 items-center justify-center bg-slate-900 text-white" aria-hidden="true">
          <MessageSquarePlus className="h-5 w-5" />
        </span>
        <h2 id="sfb-title" className="mt-4 text-xl !normal-case">{t("Not quite right?")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("Tell the strategist what you know: budgets, partner wishes, a market that works for you. It keeps what you liked, replaces what you rejected and writes a new version. Your note is a hint, never shown as data.")}
        </p>
        <p className="mt-4 text-xs text-muted">
          {left > 0 ? t(left === 1 ? "{n} new version possible for this plan." : "{n} new versions possible for this plan.", { n: left }) : t("Version limit reached: start from a new explanation instead.")}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <label className="label !mb-0" htmlFor="sfb-note">{t("Your note")}</label>
        <textarea
          id="sfb-note"
          className="field !min-h-28 !py-2"
          maxLength={500}
          placeholder={t("e.g. Hoteliers don't want discounts after Easter. Try British families, they book late.")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("What is wrong overall")}>
            {STRATEGY_TAGS.map((tag) => (
              <button key={tag} type="button" className="seg-btn !normal-case !tracking-normal" aria-pressed={tags.includes(tag)} onClick={() => setTags((x) => (x.includes(tag) ? x.filter((y) => y !== tag) : [...x, tag]))}>
                {t(tag)}
              </button>
            ))}
          </div>
          <span className="text-xs tabular-nums text-muted">{note.length}/500</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">{pending > 0 ? t(pending === 1 ? "{n} card correction will be included." : "{n} card corrections will be included.", { n: pending }) : t("Corrections from the cards are included too.")}</p>
          <button type="submit" className="btn" disabled={!canSend} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            {busy ? t("Rethinking …") : t("Reanalyse")}
          </button>
        </div>
      </div>
    </form>
  );
}
