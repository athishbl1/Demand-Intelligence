"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtDate, fmtInt } from "@/lib/dashboard";
import type { SeriesPoint } from "@/lib/agent";
import { axisLabel, linePath, niceTicks, useElementWidth } from "@/components/dash/chart-utils";

const H = 220;
const M = { top: 12, right: 12, bottom: 26, left: 46 };

/** Actual (crimson, solid), forecast (grey, dashed) and last year (amber) over ±3 weeks; the asked period is shaded. */
export function PeriodChart({ series }: { series: SeriesPoint[] }) {
  const { ref, width } = useElementWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);

  const g = useMemo(() => {
    const n = series.length;
    const iw = Math.max(10, width - M.left - M.right);
    const ih = H - M.top - M.bottom;
    const max = Math.max(1, ...series.flatMap((d) => [d.actual ?? 0, d.forecast ?? 0, d.previous_year ?? 0]));
    const ticks = niceTicks(0, max, 4);
    const top = ticks[ticks.length - 1] || max;
    const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => M.top + ih - (v / top) * ih;
    const pts = (k: "actual" | "forecast" | "previous_year") => series.map((d, i) => (d[k] === null || d[k] === undefined ? null : { x: x(i), y: y(d[k] as number) }));
    const inIdx = series.map((d, i) => (d.in_period ? i : -1)).filter((i) => i >= 0);
    const band = inIdx.length ? { x0: x(inIdx[0]) - (n > 1 ? iw / (n - 1) / 2 : 6), x1: x(inIdx[inIdx.length - 1]) + (n > 1 ? iw / (n - 1) / 2 : 6) } : null;
    const months = series.map((d, i) => ({ i, d })).filter(({ d }, i) => i === 0 || d.date.slice(8) === "01" || (i % Math.ceil(n / 6) === 0 && n > 10));
    return { x, y, ticks, top, ih, iw, n, act: linePath(pts("actual")), fc: linePath(pts("forecast")), py: linePath(pts("previous_year")), band, months };
  }, [series, width]);

  const onMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - r.left - M.left;
    const i = Math.round((px / g.iw) * (g.n - 1));
    setHover(i >= 0 && i < g.n ? i : null);
  };
  const h = hover !== null ? series[hover] : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="legend" aria-hidden="true">
        <span className="legend-item" style={{ color: "var(--viz-actual)" }}><span className="legend-line" />{tr("Actual")}</span>
        <span className="legend-item" style={{ color: "var(--viz-forecast)" }}><span className="legend-line" style={{ borderTopStyle: "dashed" }} />{tr("Forecast")}</span>
        <span className="legend-item" style={{ color: "var(--viz-py)" }}><span className="legend-line" />{tr("Last year")}</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--viz-actual-wash)" }} />{tr("Asked period")}</span>
      </div>
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={tr("Overnight stays: actual, forecast and last year around the asked period")}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-none"
        >
          {g.band && <rect x={g.band.x0} y={M.top} width={Math.max(2, g.band.x1 - g.band.x0)} height={g.ih} fill="var(--viz-actual-wash)" />}
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={g.y(t)} y2={g.y(t)} stroke="var(--viz-grid)" />
              <text x={M.left - 6} y={g.y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--viz-ink-muted)">{axisLabel(t, g.top)}</text>
            </g>
          ))}
          {g.months.map(({ i, d }) => (
            <text key={d.date} x={g.x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--viz-ink-muted)">{fmtDate(d.date, false)}</text>
          ))}
          <path d={g.py} fill="none" stroke="var(--viz-py)" strokeWidth={1.75} />
          <path d={g.fc} fill="none" stroke="var(--viz-forecast)" strokeWidth={1.75} strokeDasharray="5 4" />
          <path d={g.act} fill="none" stroke="var(--viz-actual)" strokeWidth={2.5} />
          {h && hover !== null && (
            <line x1={g.x(hover)} x2={g.x(hover)} y1={M.top} y2={M.top + g.ih} stroke="var(--viz-axis)" />
          )}
        </svg>
        {h && hover !== null && (
          <div className="viz-tooltip" style={{ left: Math.min(Math.max(0, g.x(hover) + 10), Math.max(0, width - 190)), top: 8 }}>
            <p className="mb-1 font-bold">{fmtDate(h.date)}{h.in_period ? " · asked period" : ""}</p>
            <div className="viz-tooltip-row"><span style={{ color: "var(--viz-actual)" }}>{tr("Actual")}</span><b>{fmtInt(h.actual)}</b></div>
            <div className="viz-tooltip-row"><span style={{ color: "var(--viz-forecast)" }}>{tr("Forecast")}</span><b>{fmtInt(h.forecast)}</b></div>
            <div className="viz-tooltip-row"><span style={{ color: "var(--viz-py)" }}>{tr("Last year")}</span><b>{fmtInt(h.previous_year)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}
