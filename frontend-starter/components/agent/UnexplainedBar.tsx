"use client";

import { Info } from "lucide-react";

/** The share of the change that no data-backed reason covers (computed in n8n, not by the AI). */
export function UnexplainedBar({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  return (
    <div className="border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="kpi-label">Unexplained remainder</span>
        <span className="text-sm font-bold tabular-nums">{pct} %</span>
      </div>
      <div className="share-bar mt-2" data-tone="muted">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {pct === 0
          ? "Every part of the change is covered by a reason backed by data. Hypotheses do not count."
          : "No reason backed by data covers this part of the change. Hypotheses do not count."}
      </p>
    </div>
  );
}
