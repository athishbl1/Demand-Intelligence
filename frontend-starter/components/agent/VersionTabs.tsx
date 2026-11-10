"use client";

import { History } from "lucide-react";
import type { Explanation } from "@/lib/agent";
import { useT } from "@/lib/i18n";

/** v1 … vn of one question as a compact switch; every reanalysis adds a version with a short change note. */
export function VersionTabs({ e, onOpen, busy }: { e: Explanation; onOpen: (id: number) => void; busy: boolean }) {
  const t = useT();
  const versions = e.versions?.length ? e.versions : [{ id: e.explanation_id, version: e.version, change_note: e.change_note, created_at: e.created_at }];
  if (versions.length < 2 && !e.change_note) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-line bg-slate-50 px-4 py-3">
      <span className="inline-flex items-center gap-2 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-600">
        <History className="h-4 w-4" aria-hidden="true" />
        {t("Versions")}
      </span>
      <div className="seg" role="tablist" aria-label={t("Versions of this explanation")}>
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            className="seg-btn"
            aria-pressed={v.id === e.explanation_id}
            aria-selected={v.id === e.explanation_id}
            disabled={busy}
            onClick={() => v.id !== e.explanation_id && onOpen(v.id)}
          >
            v{v.version}
          </button>
        ))}
      </div>
      {e.change_note && <p className="min-w-0 flex-1 text-sm text-slate-600">{t("What changed")}: {e.change_note}</p>}
    </div>
  );
}
