"use client";

import { useT } from "@/lib/i18n";
import { fmtDate } from "@/lib/dashboard";
import type { Timing } from "@/lib/strategy";

const day = (iso: string) => new Date(iso + "T00:00:00Z").getTime();
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/**
 * Today → launch by → target window on one line, to scale. The launch marker is crimson; the window is a
 * soft accent band with its own on-bar caption, so the bar and the dates under it always agree, even when
 * "today" and "launch by" fall only a day or two apart.
 */
export function TargetTimeline({ timing, today, compact }: { timing: Timing; today: string; compact?: boolean }) {
  const t = useT();
  const start = Math.min(day(today), day(timing.ideal_launch));
  const end = day(timing.to);
  const span = Math.max(1, end - start);
  const posNum = (iso: string) => clamp(((day(iso) - start) / span) * 100);
  const pToday = posNum(today);
  const pLaunch = posNum(timing.launch_by);
  const winLeft = posNum(timing.from);
  const winRight = clamp(((day(timing.to) + 86_400_000 - start) / span) * 100);
  const winWidth = Math.max(3, winRight - winLeft);
  const winCenter = winLeft + winWidth / 2;
  const daysToLaunch = Math.round((day(timing.launch_by) - day(today)) / 86_400_000);

  // Keep the three date labels from crowding each other when the dates sit close together.
  const labelLaunch = Math.max(pLaunch, pToday + 16);
  const labelWin = Math.max(winCenter, labelLaunch + 16);

  const label = (pct: number, text: string, extra = "") => (
    <span
      className={`absolute top-6 -translate-x-1/2 whitespace-nowrap font-semibold tabular-nums ${extra}`}
      style={{ left: `${clamp(pct, 6, 94)}%` }}
    >
      {text}
    </span>
  );

  return (
    <div className={compact ? "" : "pt-1"}>
      {/* bar: track, the target-window band (soft accent fill, not a heavy solid block) and the two markers,
          with each date aligned directly under its own marker instead of three evenly spaced columns */}
      <div className={`relative ${compact ? "h-11 text-[11px]" : "h-12 text-xs"}`}>
        <span className="absolute inset-x-0 top-3.5 h-1 rounded-full bg-slate-100" aria-hidden="true" />
        <span
          className="absolute top-3.5 h-1 rounded-full bg-accent/20"
          style={{ left: `${winLeft}%`, width: `${winWidth}%` }}
          aria-hidden="true"
        />
        <span className="absolute top-2.5 h-3 w-[3px] rounded-full bg-accent" style={{ left: `${winLeft}%` }} aria-hidden="true" />
        <span className="absolute top-2.5 h-3 w-[3px] rounded-full bg-accent" style={{ left: `${winRight}%` }} aria-hidden="true" />
        {/* today */}
        <span className="absolute top-2 h-4 w-[3px] rounded-full bg-slate-400" style={{ left: `${pToday}%` }} aria-hidden="true" />
        {/* launch */}
        <span className="absolute top-1.5 h-5 w-1 rounded-full bg-slate-900" style={{ left: `${pLaunch}%` }} aria-hidden="true" />

        {label(pToday, fmtDate(today, false), "text-muted")}
        {label(labelLaunch, fmtDate(timing.launch_by, false), timing.late ? "text-accent" : "")}
        {label(labelWin, `${fmtDate(timing.from, false)} – ${fmtDate(timing.to)}`, "text-accent")}
      </div>
      <dl className={`grid grid-cols-3 gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
        <dt className="text-muted">{t("Today")}</dt>
        <dt className={`text-center ${timing.late ? "font-semibold text-accent" : "text-muted"}`}>
          {timing.late ? t("Launch now (late)") : t("Launch by")}
          {!timing.late && <span className="font-normal text-muted"> · {t("in {n} d", { n: daysToLaunch })}</span>}
        </dt>
        <dt className="text-right text-muted">{timing.neighbour ? t("Neighbour week") : t("Target window")}</dt>
      </dl>
    </div>
  );
}
