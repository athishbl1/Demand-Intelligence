"use client";

import { useT } from "@/lib/i18n";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { fmtCompact, fmtDate, fmtSignedPct } from "@/lib/dashboard";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";

function Delta({ pct, label }: { pct: number | null | undefined; label: string }) {
  const t = useT();
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta mt-2 ${up ? "delta-good" : "delta-bad"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {fmtSignedPct(pct)} <span className="font-medium text-slate-500">{t(label)}</span>
    </span>
  );
}

/** Four headline numbers straight from the live n8n answer. */
export function LiveKpiBand({ data }: { data: DashboardData | null }) {
  const t = useT();
  const k = data?.kpis;
  const tiles = [
    {
      label: t("Overnight stays last winter"),
      value: k ? fmtCompact(k.actual) : null,
      foot: <Delta pct={k?.gap_py_pct} label="vs year before" />,
    },
    {
      label: t("Actual vs TVB forecast"),
      value: k ? fmtCompact(Math.abs(k.gap_fc)) : null,
      foot: <Delta pct={k?.gap_fc_pct} label="stays missed" />,
    },
    {
      label: t("Next winter forecast"),
      value: k?.next_season ? fmtCompact(k.next_season.forecast) : null,
      foot: <Delta pct={k?.next_season?.fc_vs_py_pct} label="vs last year" />,
      accent: true,
    },
    {
      label: t("Days checked for data issues"),
      value: data ? String(data.quality.days) : null,
      foot: data ? (
        <span className="mt-2 text-xs text-slate-500">
          <b className="text-[var(--delta-bad)]">{data.quality.red_days} {t("red")}</b> · {data.quality.yellow_days} {t("to check")} · {t("until")} {fmtDate(data.quality.last_actual)}
        </span>
      ) : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 border border-slate-200 bg-white shadow-[var(--shadow-premium)] min-[480px]:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile, i) => (
        <Reveal
          key={tile.label}
          delay={i * 90}
          className={`flex flex-col border-slate-200 p-5 sm:p-7 ${i < 3 ? "border-b lg:border-b-0" : ""} ${i === 2 ? "min-[480px]:border-b-0" : ""} ${
            i % 2 === 0 ? "min-[480px]:border-r" : ""
          } ${i === 1 ? "lg:border-r" : ""}`}
        >
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{tile.label}</span>
          {tile.value === null ? (
            <span className="skeleton mt-2 h-10 w-28" />
          ) : (
            <CountUp value={tile.value} className={`mt-2 block font-display text-4xl font-black leading-none ${tile.accent ? "text-accent" : "text-slate-900"}`} />
          )}
          {tile.foot}
        </Reveal>
      ))}
    </div>
  );
}
