"use client";

import { useT } from "@/lib/i18n";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardData, Week } from "@/lib/dashboard";
import { fmtInt, fmtRange, fmtSignedPct } from "@/lib/dashboard";

const CAPACITY = 22_078; // monitored beds in the valley (R54)

type Status = "fill" | "protect" | "track";
const STATUS: Record<Status, { label: string; badge: string; hint: string }> = {
  fill: { label: "Fill the gap", badge: "badge-red", hint: "Launch packages now" },
  protect: { label: "Protect rates", badge: "badge-green", hint: "No discounts" },
  track: { label: "On track", badge: "badge-gray", hint: "Monitor" },
};

/** Capacity state from forecast demand against monitored beds (an estimate, see note under the cards). */
const capacityOf = (occ: number) => (occ >= 0.85 ? { label: "Tight capacity", cls: "badge-red" } : occ < 0.4 ? { label: "Unused capacity", cls: "badge-gray" } : null);

const occupancyOf = (w: Week) => Math.min(1, (w.forecast ?? 0) / (CAPACITY * w.days));

/** Behind last year → fill; busy and ahead (or nearly full) → protect rates; otherwise on track. */
function statusOf(w: Week): Status {
  const p = w.fc_vs_py_pct ?? 0;
  const occ = occupancyOf(w);
  if (p <= -5) return "fill";
  if (occ >= 0.85 || (p >= 5 && occ >= 0.6)) return "protect";
  return "track";
}

/** The next eight weeks from the live forecast, each with a recommended stance. */
export function WeeksRadar({ data }: { data: DashboardData | null }) {
  const t = useT();
  const [filter, setFilter] = useState<"all" | Status>("all");

  const upcoming = useMemo(() => {
    if (!data) return [];
    const ref = data.generated_at.slice(0, 10);
    // Skip closed weeks between seasons (under 10 % of beds): start with the first open week.
    return data.weeks.filter((w) => w.week_end >= ref && w.forecast !== null && occupancyOf(w) >= 0.1).slice(0, 8);
  }, [data]);

  const counts = upcoming.reduce<Record<Status, number>>((c, w) => ({ ...c, [statusOf(w)]: c[statusOf(w)] + 1 }), { fill: 0, protect: 0, track: 0 });
  const shown = upcoming.filter((w) => filter === "all" || statusOf(w) === filter);
  const filters: { id: "all" | Status; label: string }[] = [
    { id: "all", label: `${t("All")} ${upcoming.length}` },
    { id: "fill", label: `${t("Fill the gap")} · ${counts.fill}` },
    { id: "protect", label: `${t("Protect rates")} · ${counts.protect}` },
    { id: "track", label: `${t("On track")} · ${counts.track}` },
  ];

  return (
    <div>
      <div className="seg" role="group" aria-label={t("Filter weeks")}>
        {filters.map((f) => (
          <button key={f.id} type="button" className="seg-btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!data &&
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-52" />)}
        {shown.map((w) => {
          const st = STATUS[statusOf(w)];
          const occ = occupancyOf(w);
          const hol = data?.holidays_by_week?.[w.week];
          const markets = hol ? Object.entries(hol.markets).filter(([, m]) => m.coverage >= 0.1).sort((a, b) => b[1].coverage - a[1].coverage).slice(0, 3) : [];
          return (
            <Link
              key={w.week}
              href={`/dashboard?week=${w.week}#weeks`}
              className="group flex animate-fade-up flex-col border border-slate-200 bg-white p-5 text-inherit transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[var(--shadow-premium)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-extrabold uppercase leading-none">{w.week}</p>
                  <p className="mt-1 text-xs text-slate-500">{fmtRange(w.week_start, w.week_end)}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-accent" aria-hidden="true" />
              </div>

              <p className="mt-4 font-display text-2xl font-black tabular-nums">{fmtInt(w.forecast)}</p>
              <p className={`text-xs font-bold ${(w.fc_vs_py_pct ?? 0) >= 0 ? "delta-good" : "delta-bad"}`}>
                {fmtSignedPct(w.fc_vs_py_pct)} <span className="font-medium text-slate-500">{t("forecast vs last year")}</span>
              </p>

              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{t("Est. bed occupancy")}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{Math.round(occ * 100)} %</span>
                </div>
                <div className="mt-1 h-1.5 bg-slate-100">
                  <div className={`h-1.5 ${occ >= 0.85 ? "bg-slate-900" : "bg-accent"}`} style={{ width: `${occ * 100}%` }} />
                </div>
              </div>

              <div className="mt-4 flex min-h-6 flex-wrap gap-1">
                {capacityOf(occ) && <span className={capacityOf(occ)!.cls}>{t(capacityOf(occ)!.label)}</span>}
                {markets.map(([code, m]) => (
                  <span key={code} className="border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600" title={t("{p} % of {c} regions on school holiday", { p: Math.round(m.coverage * 100), c: code })}>
                    {code} {Math.round(m.coverage * 100)}%
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <span className={st.badge}>{t(st.label)}</span>
                <span className="text-[11px] text-slate-500">{t(st.hint)}</span>
              </div>
            </Link>
          );
        })}
        {data && shown.length === 0 && <p className="text-sm text-slate-500">{t("No week in this group.")}</p>}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t("Occupancy is an estimate: forecast stays ÷ ({n} monitored beds × days). Tight ≥ 85 %, unused < 40 %. The partner data holds free-bed figures for early winter only, so later weeks cannot be checked against real availability.", { n: fmtInt(CAPACITY) })}
      </p>
    </div>
  );
}
