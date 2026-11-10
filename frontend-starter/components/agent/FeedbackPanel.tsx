"use client";

import { useT } from "@/lib/i18n";
import { useState } from "react";
import { MessageSquarePlus, RotateCcw } from "lucide-react";
import { FEEDBACK_TAGS, MAX_VERSIONS, type FeedbackTag } from "@/lib/agent";

/**
 * "Did the agent miss something?" Collects a note and tags for the whole answer; the parent adds the
 * per-reason corrections and sends everything with Reanalyse (the one crimson button of this view).
 */
export function FeedbackPanel({
  versions,
  pending,
  busy,
  onReanalyse,
}: {
  versions: number;
  /** Number of reason cards with an unsent correction. */
  pending: number;
  busy: boolean;
  onReanalyse: (note: string, tags: FeedbackTag[]) => Promise<boolean>;
}) {
  const t = useT();
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const left = Math.max(0, MAX_VERSIONS - versions);
  const canSend = left > 0 && !busy && (note.trim().length > 0 || tags.length > 0 || pending > 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canSend) return;
    const ok = await onReanalyse(note.trim(), tags);
    if (ok) {
      setNote("");
      setTags([]);
    }
  };

  return (
    <form className="grid gap-6 border border-line bg-white p-5 sm:p-7 lg:grid-cols-[0.8fr_1.2fr]" onSubmit={submit} aria-labelledby="fb-title">
      <div>
        <span className="flex h-10 w-10 items-center justify-center bg-slate-900 text-white" aria-hidden="true">
          <MessageSquarePlus className="h-5 w-5" />
        </span>
        <h2 id="fb-title" className="mt-4 text-xl !normal-case">{t("Did the agent miss something?")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("Add what you know, for example a closed lift or a cancelled event. The agent treats it as a hint, checks it against the data and writes a new version. Your note is never shown as a fact.")}
        </p>
        <p className="mt-4 text-xs text-muted">
          {left > 0 ? t(left === 1 ? "{n} new version possible for this question." : "{n} new versions possible for this question.", { n: left }) : t("Version limit reached: ask a new question instead.")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="label !mb-0" htmlFor="fb-note">{t("Your note")}</label>
        <textarea
          id="fb-note"
          className="field !min-h-28 !py-2"
          maxLength={500}
          placeholder={t("e.g. The lifts closed a week earlier this spring. Check the Dutch holidays.")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("What is wrong overall")}>
            {FEEDBACK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="seg-btn !normal-case !tracking-normal"
                aria-pressed={tags.includes(tag)}
                onClick={() => setTags((x) => (x.includes(tag) ? x.filter((y) => y !== tag) : [...x, tag]))}
              >
                {t(tag)}
              </button>
            ))}
          </div>
          <span className="text-xs tabular-nums text-muted">{note.length}/500</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">
            {pending > 0 ? t(pending === 1 ? "{n} correction from the reason cards will be included." : "{n} corrections from the reason cards will be included.", { n: pending }) : t("Corrections from the reason cards are included too.")}
          </p>
          <button type="submit" className="btn" disabled={!canSend} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            {busy ? t("Reanalysing …") : t("Reanalyse")}
          </button>
        </div>
      </div>
    </form>
  );
}
