"use client";

import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";
import { fmtSignedPct } from "@/lib/dashboard";
import { tr } from "@/lib/i18n";

/** Small outlined button that downloads the card's data as CSV. */
export function ExportButton({ onClick, label = "CSV" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="seg-btn inline-flex items-center gap-1.5" onClick={onClick} title={tr("Download as CSV")}>
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Signed percentage chip; colour follows the sign, the sign and number carry the meaning. */
export function GapChip({ pct, title }: { pct: number | null | undefined; title?: string }) {
  if (pct === null || pct === undefined) return <span className="gap-chip flat">–</span>;
  const cls = pct <= -0.5 ? "neg" : pct >= 0.5 ? "pos" : "flat";
  const Icon = cls === "neg" ? ArrowDownRight : cls === "pos" ? ArrowUpRight : Minus;
  return (
    <span className={`gap-chip ${cls}`} title={title}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {fmtSignedPct(pct)}
    </span>
  );
}

export function CardHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="dash-card-head">
      <div className="min-w-0">
        <h3 className="dash-h2">{tr(title)}</h3>
        {sub && <p className="dash-sub mt-0.5">{tr(sub)}</p>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={tr(label)}>
      {options.map((o) => (
        <button key={o.id} type="button" className="seg-btn" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {tr(o.label)}
        </button>
      ))}
    </div>
  );
}
