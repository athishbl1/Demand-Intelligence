"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { fmtSignedPct } from "@/lib/dashboard";
import { ruleInfo, CHANGE_LABEL, SEVERITY_BADGE, direction, type Alert } from "@/lib/agent";
import { ruleValue } from "./AlertRules";

/** Pops up for 10 s when a new alert arrives (Esc closes it). */
export function AlertToast({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(onClose, 10_000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [alert, onClose]);

  if (!alert) return null;
  const dir = direction(alert.change_type);
  return (
    <div className="toast" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">New alert</p>
          <p className="mt-2 font-display text-base font-extrabold uppercase tracking-wide">
            {dir === "down" ? "▼" : dir === "up" ? "▲" : "⚠"} {ruleInfo(alert.alert_type) ? `${ruleInfo(alert.alert_type)!.label}: ${ruleValue(alert.alert_type!, alert.delta_pct === null ? null : Number(alert.delta_pct))}` : alert.delta_pct !== null ? fmtSignedPct(Number(alert.delta_pct)) : CHANGE_LABEL[alert.change_type]} · {alert.scope_label ?? alert.date}
          </p>
          <p className="mt-1 text-sm text-slate-600">{alert.headline ?? CHANGE_LABEL[alert.change_type]}</p>
        </div>
        <button type="button" className="btn-secondary !min-h-8 !px-2" onClick={onClose} aria-label="Close alert">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className={SEVERITY_BADGE[alert.severity] ?? "badge-gray"}>{alert.severity}</span>
        <Link href={`/alerts/${alert.id}`} className="btn-ghost !text-xs" onClick={onClose}>Open the reasons →</Link>
      </div>
    </div>
  );
}
