"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, Sparkles } from "lucide-react";
import { clampRange, explainHref, seasonWindow } from "@/components/agent/links";
import type { DashboardData } from "@/lib/dashboard";
import { tr } from "@/lib/i18n";
import { fmtCompact, fmtDate, fmtInt, fmtShare, fmtSignedInt, fmtSignedPct } from "@/lib/dashboard";
import { seasonKpiSummary } from "./derive";

function Delta({ pct, abs, vs }: { pct: number; abs?: number; vs: string }) {
  const up = pct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex flex-col gap-0.5">
      <span className={`delta whitespace-nowrap ${up ? "delta-good" : "delta-bad"}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {fmtSignedPct(pct)} <span className="font-medium text-muted">{tr("vs")} {tr(vs)}</span>
      </span>
      {abs !== undefined && <span className="text-xs tabular-nums text-muted">{fmtSignedInt(abs)} {tr("stays")}</span>}
    </span>
  );
}

/** A KPI tile that opens the Change Explainer for its window and jumps to the reasons. */
function ExplainTile({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) return <div className="kpi-tile">{children}</div>;
  return (
    <Link href={href} className="kpi-tile group text-inherit" aria-label={`${tr(label)}: ${tr("Explain why")}`} prefetch>
      {children}
      <span className="mt-auto inline-flex items-center gap-1 pt-1 font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {tr("Explain why")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** KPI tiles for the Overview tab. Tiles 1–2 follow the season the team picked; tile 3 is always
 * the look-ahead to next winter, and tile 4 ("free beds today") is always "now", neither season-dependent. */
export function KpiTiles({ data, seasonId }: { data: DashboardData; seasonId: string }) {
  const k = data.kpis;
  const next = k.next_season;
  const nextWindow = next ? seasonWindow(next.season) : null;
  const s = seasonKpiSummary(data, seasonId);
  const range = clampRange(s.season.from, s.season.to);

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <ExplainTile href={explainHref(range, "py")} label={s.hasActual ? "Actual overnight stays" : "Forecast overnight stays"}>
        <span className="kpi-label">{tr(s.hasActual ? "Actual overnight stays" : "Forecast overnight stays")}</span>
        <span className="kpi-value" title={fmtInt(s.hasActual ? s.actual : s.forecast)}>{fmtCompact(s.hasActual ? s.actual : s.forecast)}</span>
        <Delta pct={s.hasActual ? s.gapPyPct! : s.fcVsPyPct!} abs={s.hasActual ? s.gapPy! : s.fcVsPy} vs="last year" />
        <span className="kpi-foot">{s.season.label} · {s.rangeLabel}</span>
      </ExplainTile>
      {s.hasActual ? (
        <ExplainTile href={explainHref(range, "fc")} label="Forecast for the same window">
          <span className="kpi-label">{tr("Forecast, same period")}</span>
          <span className="kpi-value" title={fmtInt(s.forecastCmp)}>{fmtCompact(s.forecastCmp)}</span>
          <Delta pct={s.gapFcPct!} abs={s.gapFc!} vs="forecast" />
          <span className="kpi-foot">{tr("actual minus forecast")}</span>
        </ExplainTile>
      ) : (
        <div className="kpi-tile">
          <span className="kpi-label">{tr("Average occupancy")}</span>
          <span className="kpi-value">{s.occupancyAvg === null ? "–" : fmtShare(s.occupancyAvg, 0)}</span>
          <span className="kpi-foot">{tr("forecast estimate, {label}", { label: s.season.label })}</span>
        </div>
      )}
      <ExplainTile href={nextWindow ? explainHref(nextWindow, "py") : null} label="Next winter: forecast">
        <span className="kpi-label">{tr("Next winter: forecast")}</span>
        <span className="kpi-value" title={next ? fmtInt(next.forecast) : undefined}>{fmtCompact(next?.forecast)}</span>
        {next && <Delta pct={next.fc_vs_py_pct} abs={next.fc_vs_py} vs="last year" />}
        <span className="kpi-foot">{next?.season ?? "–"}</span>
      </ExplainTile>
      <div className="kpi-tile">
        <span className="kpi-label">{tr("Free beds today")}</span>
        <span className="kpi-value">{fmtInt(k.free_beds_latest?.beds)}</span>
        <span className="kpi-foot inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {k.free_beds_latest ? tr("as of {d}", { d: fmtDate(k.free_beds_latest.date) }) : tr("no data")}
        </span>
      </div>
    </div>
  );
}
