"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { fmtDate, fmtRange } from "@/lib/dashboard";
import { useT } from "@/lib/i18n";
import type { Target } from "@/lib/strategy";

/** Asks the team to confirm a chosen plan before it is saved and shown in the strategy dashboard. */
export function ConfirmPlanDialog({
  title,
  target,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  target: Target;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-lg border border-line bg-white shadow-[var(--shadow-premium)]"
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-7">
          <div className="min-w-0">
            <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">{t("Confirm your choice")}</p>
            <h2 id="confirm-title" className="mt-2 text-2xl !normal-case leading-tight">{title}</h2>
          </div>
          <button type="button" className="btn-secondary !min-h-9 !px-2" onClick={onCancel} disabled={busy} aria-label={t("Cancel")}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="mx-6 mt-3 grid grid-cols-2 gap-px border border-line bg-[var(--line)] text-sm">
          <div className="bg-white p-3">
            <dt className="kpi-label">{t("Target week")}</dt>
            <dd className="mt-1 font-bold">{target.label}</dd>
            <dd className="text-xs text-muted">{fmtRange(target.from, target.to)}</dd>
          </div>
          <div className="bg-white p-3">
            <dt className="kpi-label">{t("Launch by")}</dt>
            <dd className="mt-1 font-bold">{fmtDate(target.launch_by)}</dd>
            <dd className="text-xs text-muted">{target.late ? t("The ideal date has passed") : t("Start planning now")}</dd>
          </div>
        </dl>
        <p className="px-6 pt-4 text-sm text-slate-600">
          {t("This becomes the strategy for {week}. You will see it in the strategy dashboard, and you can undo it any time.", { week: target.label })}
        </p>
        <div className="flex flex-wrap justify-end gap-2 px-6 pb-6 pt-5">
          <button ref={cancelRef} type="button" className="btn-secondary !min-h-11 !text-xs" onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn !min-h-11 !text-xs" onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {t("Confirm and proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}
