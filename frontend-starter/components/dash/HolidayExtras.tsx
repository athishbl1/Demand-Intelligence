"use client";

import { tr } from "@/lib/i18n";
import { useMemo } from "react";
import type { DashboardData, Week } from "@/lib/dashboard";
import { MARKETS, fmtDate, fmtInt, fmtSignedPct } from "@/lib/dashboard";
import { CardHead } from "./bits";
import { daysBetween, refDate } from "./derive";

/** Next school-holiday starts per market from the data date, with the forecast of the starting week. */
export function UpcomingHolidays({ data, onSelectWeek }: { data: DashboardData; onSelectWeek: (w: string) => void }) {
  const ref = refDate(data);
  const list = useMemo(() => {
    const weeks = data.weeks.filter((w) => w.week_end >= ref);
    const out: { code: string; name: string; start: Week; length: number; peak: number; names: string[] }[] = [];
    for (const m of MARKETS) {
      let run: Week[] = [];
      const flush = () => {
        if (run.length) {
          const cov = run.map((w) => data.holidays_by_week?.[w.week]?.markets?.[m.code]);
          out.push({
            code: m.code,
            name: m.name,
            start: run[0],
            length: run.length,
            peak: Math.max(...cov.map((c) => c?.coverage ?? 0)),
            names: [...new Set(cov.flatMap((c) => c?.names ?? []).map((n) => n.trim()))].filter((n, i, a) => a.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i),
          });
        }
        run = [];
      };
      for (const w of weeks) {
        const c = data.holidays_by_week?.[w.week]?.markets?.[m.code]?.coverage ?? 0;
        if (c >= 0.25) run.push(w);
        else flush();
      }
      flush();
    }
    return out.sort((a, b) => a.start.week_start.localeCompare(b.start.week_start)).slice(0, 10);
  }, [data, ref]);

  return (
    <section className="dash-card">
      <CardHead title={tr("Upcoming holiday starts")} sub={`Next school-holiday periods in the source markets from ${fmtDate(ref)} (at least 25 % of a market's regions).`} />
      {list.length === 0 ? (
        <p className="dash-sub">{tr("No school holidays in the forecast horizon.")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-[var(--line)] border-y border-line">
          {list.map((h) => (
            <li key={`${h.code}-${h.start.week}`}>
              <button type="button" className="row-btn group flex items-center gap-4 px-1 py-3 hover:bg-accent-light" onClick={() => onSelectWeek(h.start.week)}>
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center bg-[var(--text)] text-white">
                  <span className="font-display text-sm font-extrabold leading-none">{h.code}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {h.name} · from {fmtDate(h.start.week_start)}
                    <span className="ml-2 text-xs font-medium text-muted">
                      {h.start.week_start <= ref ? <b className="text-accent">{tr("running now")}</b> : `in ${daysBetween(ref, h.start.week_start)} days`} · {h.length} week
                      {h.length > 1 ? "s" : ""} · up to {Math.round(h.peak * 100)} %
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted">{h.names.join(", ") || "School holiday"}</span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block text-sm font-semibold tabular-nums">{fmtInt(h.start.forecast)}</span>
                  <span className={`block text-xs font-semibold ${(h.start.fc_vs_py_pct ?? 0) >= 0 ? "delta-good" : "delta-bad"}`}>{fmtSignedPct(h.start.fc_vs_py_pct)} vs LY</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
