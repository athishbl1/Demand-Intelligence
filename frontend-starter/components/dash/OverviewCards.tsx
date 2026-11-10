"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { SEASONS, fmtRange, fmtSignedInt, fmtSignedPct, inSeason, OVERVIEW_SEASONS } from "@/lib/dashboard";
import { tr } from "@/lib/i18n";
import { CardHead, Segmented } from "./bits";
import { movers } from "./derive";

type Basis = "py" | "fc";

/** Full weeks with the largest shortfall (or surplus), as a ranked bar list; each row opens the week panel. */
export function BiggestGaps({ data, seasonId, onSelectWeek }: { data: DashboardData; seasonId: string; onSelectWeek: (w: string) => void }) {
  const [basis, setBasis] = useState<Basis>("py");
  const [dir, setDir] = useState<"down" | "up">("down");
  const season = seasonId === "all" ? SEASONS.find((s) => s.id === "all")! : (OVERVIEW_SEASONS.find((s) => s.id === seasonId) ?? OVERVIEW_SEASONS[0]);
  const weeks = useMemo(() => data.weeks.filter((w) => inSeason(w.week_start, season)), [data, season]);
  const rows = useMemo(() => movers(weeks, basis, dir), [weeks, basis, dir]);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.gap)));

  return (
    <section className="dash-card">
      <CardHead title="Biggest movers" sub={dir === "down" ? "Fully reported weeks with the largest shortfall in overnight stays." : "Fully reported weeks with the largest surplus in overnight stays."} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented<"down" | "up">
          label="Direction"
          value={dir}
          onChange={setDir}
          options={[
            { id: "down", label: "Drops" },
            { id: "up", label: "Gains" },
          ]}
        />
        <Segmented<Basis>
          label="Compare with"
          value={basis}
          onChange={setBasis}
          options={[
            { id: "py", label: "vs last year" },
            { id: "fc", label: "vs forecast" },
          ]}
        />
      </div>
      <ol className="flex flex-col gap-1">
        {rows.map(({ w, gap, pct }, i) => (
          <li key={w.week}>
            <button type="button" className="row-btn group rounded-lg px-2 py-2 hover:bg-surface-muted" onClick={() => onSelectWeek(w.week)}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="mr-2 text-xs font-semibold text-muted">{i + 1}</span>
                  <b>{w.week}</b>
                  <span className="block pl-4 text-xs text-muted">{fmtRange(w.week_start, w.week_end)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 tabular-nums">
                  <b>{fmtSignedInt(gap)}</b>
                  <span className="text-xs text-muted">({fmtSignedPct(pct)})</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full bg-surface-muted">
                <div className="h-2" style={{ width: `${(Math.abs(gap) / max) * 100}%`, background: dir === "down" ? "var(--status-critical)" : "var(--status-good)" }} />
              </div>
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="dash-sub">
            {tr(dir === "down" ? (basis === "py" ? "No full week below last year." : "No full week below forecast.") : basis === "py" ? "No full week above last year." : "No full week above forecast.")}
          </li>
        )}
      </ol>
    </section>
  );
}
