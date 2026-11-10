"use client";

import { useT } from "@/lib/i18n";
import { useMemo, useState, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ArrowRight, BedDouble, CalendarClock, Gauge } from "lucide-react";
import type { DashboardData, DataSource } from "@/lib/dashboard";
import { fmtCompact, fmtDate, fmtInt, fmtShare, fmtSignedPct, SEASONS, inSeason } from "@/lib/dashboard";
import { SEASON_START } from "@/components/ui/Countdown";
import { ago } from "./useLive";

const W = 320;
const H = 96;

/** Live dashboard preview in the hero: next-winter forecast with an interactive weekly sparkline. */
export function LiveHeroCard({
  data,
  source,
  loading,
  updatedAt,
  now,
}: {
  data: DashboardData | null;
  source: DataSource | null;
  loading: boolean;
  updatedAt: number | null;
  now: number | null;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);

  const weeks = useMemo(() => {
    const season = SEASONS.find((s) => s.id === "w2627")!;
    return (data?.weeks ?? []).filter((w) => inSeason(w.week_start, season) && w.forecast !== null);
  }, [data]);

  const max = Math.max(1, ...weeks.map((w) => Math.max(w.forecast ?? 0, w.previous_year ?? 0)));
  const x = (i: number) => (weeks.length > 1 ? (i / (weeks.length - 1)) * W : W / 2);
  const y = (v: number) => H - 6 - (v / max) * (H - 14);
  const fcLine = weeks.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w.forecast ?? 0).toFixed(1)}`).join("");
  const pyLine = weeks.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w.previous_year ?? 0).toFixed(1)}`).join("");
  const area = weeks.length ? `${fcLine}L${W},${H}L0,${H}Z` : "";

  const next = data?.kpis.next_season ?? null;
  const hw = hover !== null ? weeks[hover] : null;
  const up = (next?.fc_vs_py_pct ?? 0) >= 0;

  const msLeft = now !== null ? Math.max(0, SEASON_START.getTime() - now) : null;
  const daysLeft = msLeft !== null ? Math.floor(msLeft / 86_400_000) : null;
  const hoursLeft = msLeft !== null ? Math.floor(msLeft / 3_600_000) % 24 : null;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!weeks.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (weeks.length - 1));
    setHover(Math.max(0, Math.min(weeks.length - 1, i)));
  };

  return (
    <div className="relative w-full max-w-md justify-self-end border border-slate-200 bg-white/95 shadow-[0_2rem_3.125rem_#1616164d] backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />

      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 pb-3 pt-4">
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-900">{t("Live dashboard")}</span>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span className="relative flex h-2 w-2">
            {source === "live" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${source === "live" ? "bg-emerald-500" : source === "demo" ? "bg-amber-400" : "bg-slate-300"}`} />
          </span>
          {source === "live" ? t("Live data") : source === "demo" ? t("Saved copy") : t("Connecting")}
          <span className="text-slate-400">·</span>
          {loading ? <span className="spinner h-3 w-3 text-slate-400" aria-label={t("Refreshing")} /> : <span aria-live="polite">{ago(now, updatedAt)}</span>}
        </span>
      </div>

      {/* headline number */}
      <div className="px-5 pt-5">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
          {hw ? t("Week of {d}", { d: fmtDate(hw.week_start) }) : `${next?.season.split(" (")[0] ?? t("Next winter")} · ${t("forecast")}`}
        </p>
        <div className="mt-1 flex items-end gap-3">
          {data ? (
            <span className="font-display text-4xl font-black leading-none tabular-nums text-slate-900">
              {hw ? fmtInt(hw.forecast) : fmtCompact(next?.forecast)}
            </span>
          ) : (
            <span className="skeleton h-9 w-32" />
          )}
          <span className="pb-1 text-xs text-slate-500">{t("overnight stays")}</span>
        </div>
        {data && (
          <p className={`mt-2 inline-flex items-center gap-1 text-sm font-bold ${(hw ? (hw.fc_vs_py_pct ?? 0) >= 0 : up) ? "delta-good" : "delta-bad"}`}>
            {(hw ? (hw.fc_vs_py_pct ?? 0) >= 0 : up) ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
            {fmtSignedPct(hw ? hw.fc_vs_py_pct : next?.fc_vs_py_pct)}
            <span className="font-medium text-slate-500">{t("vs last year")}</span>
          </p>
        )}
      </div>

      {/* sparkline */}
      <div className="px-5 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-24 w-full cursor-crosshair touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={t("Weekly forecast for next winter against last year")}
        >
          <path d={area} fill="var(--viz-actual-wash)" />
          <path d={pyLine} fill="none" stroke="var(--viz-py)" strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={fcLine} fill="none" stroke="var(--viz-actual)" strokeWidth={2.25} vectorEffect="non-scaling-stroke" />
          {hover !== null && hw && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--viz-ink)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <circle cx={x(hover)} cy={y(hw.forecast ?? 0)} r={3.5} fill="var(--viz-actual)" stroke="var(--surface)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-accent" />{t("Forecast")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed border-amber-500" />{t("Last year")}</span>
          </span>
          <span>{weeks.length ? `${fmtDate(weeks[0].week_start, false)} – ${fmtDate(weeks[weeks.length - 1].week_end, false)}` : ""}</span>
        </div>
      </div>

      {/* three facts */}
      <dl className="mt-5 grid grid-cols-3 border-t border-slate-200">
        <div className="border-r border-slate-200 p-4">
          <dt className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
            <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />{t("Free beds")}
          </dt>
          <dd className="mt-1 font-display text-lg font-extrabold tabular-nums">{data ? fmtInt(data.kpis.free_beds_latest?.beds) : "–"}</dd>
        </div>
        <div className="border-r border-slate-200 p-4">
          <dt className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />{t("Occupancy")}
          </dt>
          <dd className="mt-1 font-display text-lg font-extrabold tabular-nums">{data ? fmtShare(data.kpis.occupancy_avg, 0) : "–"}</dd>
        </div>
        <div className="p-4">
          <dt className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{t("Opening")}
          </dt>
          <dd className="mt-1 font-display text-lg font-extrabold tabular-nums text-accent">
            {daysLeft === null ? "–" : `${daysLeft}d ${hoursLeft}h`}
          </dd>
        </div>
      </dl>

      <Link href="/dashboard" className="group flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-900 hover:text-white">
        <span className="font-display uppercase tracking-[0.08em]">{t("Open the full dashboard")}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </Link>
    </div>
  );
}
