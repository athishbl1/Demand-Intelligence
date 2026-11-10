"use client";

import { formatNumber } from "@/lib/app";
import type { Fact } from "@/lib/agent";
import { useT } from "@/lib/i18n";
import { simplifyFact } from "./plainFacts";

const show = (v: string | number | null) => (v === null || v === undefined ? "" : typeof v === "number" ? formatNumber(v) : v);

/** The facts a reason cites, in simple words: what it is, the number, how it compares, and where it comes from. */
export function EvidenceChips({ refs, facts }: { refs: string[]; facts: Fact[] }) {
  const t = useT();
  const list = refs.map((id) => facts.find((f) => f.id === id)).filter((f): f is Fact => !!f);
  if (!list.length) return null;
  return (
    <ul className="flex flex-col divide-y divide-[var(--line)] border border-line bg-slate-50" aria-label={t("Evidence")}>
      {list.map((f) => {
        const p = simplifyFact(f);
        return (
          <li key={f.id} className="px-3.5 py-3 text-sm" title={f.note || undefined}>
            <p className="text-[13px] text-slate-600">{p.label}</p>
            <p className="mt-0.5 text-base">
              <b className="tabular-nums">{show(p.now)}</b>
              {p.ref !== null && p.ref !== undefined && p.ref !== "" && (
                <span className="text-slate-500">
                  {" "}
                  {p.isRange ? `(${show(p.ref)})` : `${t("vs")} ${show(p.ref)}`}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("Source")}: {p.source}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export const evidenceCount = (refs: string[], facts: Fact[]) => refs.filter((id) => facts.some((f) => f.id === id)).length;
