"use client";
import { getLang } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";

/** Width of an element, kept in sync with ResizeObserver, so SVG text stays crisp at any size. */
export function useElementWidth<T extends HTMLElement>(fallback = 800) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return { ref, width };
}

/** Round tick values from 0 (or min) to max, about `count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Axis tick label: full under 10,000, compact above (one style per axis). */
export function axisLabel(v: number, max: number): string {
  if (max < 10_000) return v.toLocaleString(getLang() === "de" ? "de-AT" : "en-US");
  if (Math.abs(v) >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  return `${+(v / 1000).toFixed(1)}K`;
}

/** SVG path for a series with gaps (null breaks the line). */
export function linePath(points: ({ x: number; y: number } | null)[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Closed area under a series down to `baseY`, one polygon per unbroken run. */
export function areaPath(points: ({ x: number; y: number } | null)[], baseY: number): string {
  let d = "";
  let run: { x: number; y: number }[] = [];
  const flush = () => {
    if (run.length > 1) {
      d += `M${run[0].x.toFixed(1)},${baseY}` + run.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("") + `L${run[run.length - 1].x.toFixed(1)},${baseY}Z`;
    }
    run = [];
  };
  for (const p of points) {
    if (!p) flush();
    else run.push(p);
  }
  flush();
  return d;
}
