"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { DashboardData, Week } from "@/lib/dashboard";
import { SEASONS, MARKETS, fmtInt, fmtRange, fmtShare, inSeason, weekGapPy } from "@/lib/dashboard";
import { CardHead, ExportButton, GapChip, Segmented } from "./bits";
import { downloadCsv, seasonsWithData } from "./derive";

type Filter = "all" | "past" | "future";
type SortKey = "week" | "actual" | "forecast" | "py" | "gap_fc" | "gap_py" | "occupancy";

const val = (w: Week, k: SortKey): number | string => {
  switch (k) {
    case "week": return w.week_start;
    case "actual": return w.actual ?? -Infinity;
    case "forecast": return w.forecast ?? -Infinity;
    case "py": return w.previous_year ?? -Infinity;
    case "gap_fc": return w.gap_fc_pct ?? Infinity;
    case "gap_py": return weekGapPy(w).pct ?? Infinity;
    case "occupancy": return w.occupancy ?? -Infinity;
  }
};

export function WeeksTable({ data, onSelectWeek }: { data: DashboardData; onSelectWeek: (w: string) => void }) {
  const seasonOptions = [...seasonsWithData(data).map((s) => ({ id: s.id, label: s.label })), { id: "all", label: "All seasons" }];
  const [seasonId, setSeasonId] = useState(seasonOptions.some((o) => o.id === "w2627") ? "w2627" : "all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "week", dir: 1 });

  const rows = useMemo(() => {
    const season = SEASONS.find((s) => s.id === seasonId) ?? SEASONS[SEASONS.length - 1];
    const q = query.trim().toLowerCase();
    const list = data.weeks.filter((w) => {
      if (!inSeason(w.week_start, season)) return false;
      if (filter === "past" && w.days_with_actual === 0) return false;
      if (filter === "future" && w.days_with_actual > 0) return false;
      if (!q) return true;
      const hol = data.holidays_by_week?.[w.week];
      const ev = data.events_by_week?.[w.week]?.top ?? [];
      const hay = [
        w.week,
        w.week_start,
        ...Object.keys(hol?.markets ?? {}).filter((c) => (hol?.markets[c]?.coverage ?? 0) >= 0.25).flatMap((c) => [c, MARKETS.find((m) => m.code === c)?.name ?? ""]),
        ...(hol?.public ?? []),
        ...ev.map((e) => `${e.name} ${e.village ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return [...list].sort((a, b) => {
      const va = val(a, sort.key);
      const vb = val(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [data, seasonId, filter, query, sort]);

  // Summary over the visible rows
  const reported = rows.filter((w) => w.days_with_actual > 0);
  const sum = (f: (w: Week) => number | null) => rows.reduce((s, w) => s + (f(w) ?? 0), 0);
  const actual = sum((w) => w.actual);
  const fcCmp = reported.reduce((s, w) => s + (w.forecast_cmp ?? 0), 0);
  const pyCmp = reported.reduce((s, w) => s + (w.previous_year_cmp ?? 0), 0);
  const forecast = sum((w) => w.forecast);
  const py = sum((w) => w.previous_year);

  const head = (key: SortKey, label: string, num = true) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={num ? "num" : undefined} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : key === "week" ? 1 : -1 })}>
          {label}
          <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} aria-hidden="true" />
        </button>
      </th>
    );
  };

  const exportCsv = () =>
    downloadCsv(
      `weeks-${seasonId}${filter !== "all" ? `-${filter}` : ""}.csv`,
      ["Week", "Start", "End", "Days", "Days with actual", "Actual", "Forecast", "Last year", "Actual vs forecast %", "vs last year %", "Basis", "Occupancy %", "Markets on holiday (>=25%)", "Top events"],
      rows.map((w) => {
        const g = weekGapPy(w);
        const hol = data.holidays_by_week?.[w.week]?.markets ?? {};
        return [
          w.week, w.week_start, w.week_end, w.days, w.days_with_actual, w.actual, w.forecast, w.previous_year,
          w.gap_fc_pct, g.pct, g.basis, w.occupancy === null ? null : (w.occupancy * 100).toFixed(1),
          Object.entries(hol).filter(([, m]) => m.coverage >= 0.25).map(([c, m]) => `${c} ${Math.round(m.coverage * 100)}%`).join(" "),
          (data.events_by_week?.[w.week]?.top ?? []).map((e) => e.name).join(" | "),
        ];
      }),
    );

  return (
    <div className="flex flex-col gap-4">
      <section className="dash-card">
        <CardHead
          title={tr("All weeks")}
          sub={tr("Reported weeks compare actuals with forecast and last year; future weeks compare the forecast with last year. Click a row for details.")}
        >
          <ExportButton onClick={exportCsv} />
        </CardHead>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented label={tr("Season")} value={seasonId} onChange={setSeasonId} options={seasonOptions} />
          <Segmented<Filter>
            label={tr("Show")}
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All" },
              { id: "past", label: "With actuals" },
              { id: "future", label: "Forecast only" },
            ]}
          />
          <label className="relative ml-auto w-full sm:w-64">
            <span className="sr-only">{tr("Search weeks")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Week, market or event …")}
              className="field !min-h-9 !py-1.5 !pl-9 !text-sm"
            />
          </label>
        </div>

        <div className="table-wrap dash-table max-h-[70vh] overflow-y-auto">
          <table>
            <thead className="sticky top-0 z-[1]">
              <tr>
                {head("week", "Week", false)}
                {head("actual", "Actual")}
                {head("forecast", "Forecast")}
                {head("py", "Last year")}
                {head("gap_fc", "vs forecast")}
                {head("gap_py", "vs last year")}
                {head("occupancy", "Occupancy")}
                <th>{tr("Markets on holiday")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const g = weekGapPy(w);
                const hol = data.holidays_by_week?.[w.week]?.markets ?? {};
                const onHoliday = MARKETS.filter((m) => (hol[m.code]?.coverage ?? 0) >= 0.25);
                const top = data.events_by_week?.[w.week]?.top ?? [];
                return (
                  <tr
                    key={w.week}
                    tabIndex={0}
                    onClick={() => onSelectWeek(w.week)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectWeek(w.week);
                      }
                    }}
                    aria-label={`Open details for ${w.week}`}
                  >
                    <td>
                      <div className="font-semibold">{w.week}</div>
                      <div className="text-xs text-muted">{fmtRange(w.week_start, w.week_end)}{w.days < 7 ? ` · ${w.days} days` : ""}</div>
                      {top.length > 0 && <div className="max-w-[16rem] truncate text-xs text-muted" title={top.map((t) => t.name).join(", ")}>◆ {top.map((t) => t.name).join(", ")}</div>}
                    </td>
                    <td className="num">{fmtInt(w.actual)}{w.days_with_actual > 0 && w.days_with_actual < w.days ? "*" : ""}</td>
                    <td className="num">{fmtInt(w.forecast)}</td>
                    <td className="num">{fmtInt(w.previous_year)}</td>
                    <td className="num"><GapChip pct={w.gap_fc_pct} /></td>
                    <td className="num">
                      <GapChip pct={g.pct} title={g.basis === "forecast" ? "forecast vs last year" : "actual vs last year"} />
                      {g.basis === "forecast" && <div className="text-[10px] text-muted">{tr("forecast")}</div>}
                    </td>
                    <td className="num">
                      <div className="flex items-center justify-end gap-2">
                        <span>{fmtShare(w.occupancy, 0)}</span>
                        {w.occupancy !== null && (
                          <span className="hidden h-1.5 w-12 bg-surface-muted sm:block" aria-hidden="true">
                            <span className="block h-1.5 bg-accent" style={{ width: `${Math.min(1, w.occupancy) * 100}%` }} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex max-w-[11rem] flex-wrap gap-1">
                        {onHoliday.length === 0 && <span className="text-xs text-muted">–</span>}
                        {onHoliday.map((m) => (
                          <span
                            key={m.code}
                            className="border border-line px-1.5 py-px text-[10px] font-bold tabular-nums text-[color:var(--text)]"
                            title={`${m.name}: ${Math.round((hol[m.code]?.coverage ?? 0) * 100)} % of regions`}
                          >
                            {m.code}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr className="!cursor-default">
                  <td colSpan={8} className="py-8 text-center text-sm text-muted">{tr("No week matches these filters.")}</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--text)] font-bold">
                  <td className="px-[0.875rem] py-[0.625rem]">Total · {rows.length} weeks</td>
                  <td className="num px-[0.875rem]">{fmtInt(actual || null)}</td>
                  <td className="num px-[0.875rem]">{fmtInt(forecast)}</td>
                  <td className="num px-[0.875rem]">{fmtInt(py)}</td>
                  <td className="num px-[0.875rem]">{fcCmp ? <GapChip pct={((actual - fcCmp) / fcCmp) * 100} /> : "–"}</td>
                  <td className="num px-[0.875rem]">{pyCmp ? <GapChip pct={((actual - pyCmp) / pyCmp) * 100} /> : py ? <GapChip pct={((forecast - py) / py) * 100} /> : "–"}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          * only some days of this week are reported yet. Holiday badge = at least 25 % of the market&apos;s regions on school holiday. Totals compare
          actuals with forecast and last year on the reported days only.
        </p>
      </section>
    </div>
  );
}
