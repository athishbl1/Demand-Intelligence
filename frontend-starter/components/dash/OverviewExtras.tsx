"use client";

import { tr } from "@/lib/i18n";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Info } from "lucide-react";
import { explainHref } from "@/components/agent/links";
import type { DashboardData } from "@/lib/dashboard";
import { fmtDate, fmtInt, fmtShare } from "@/lib/dashboard";
import { CardHead, ExportButton, GapChip } from "./bits";
import { downloadCsv, insights, monthName, monthly, seasonDays, type Tone } from "./derive";

/* ------------------------------------------------------------------ key insights */

const TONE: Record<Tone, { Icon: typeof Info; cls: string }> = {
  good: { Icon: ArrowUpRight, cls: "text-[var(--delta-good)]" },
  bad: { Icon: ArrowDownRight, cls: "text-[var(--delta-bad)]" },
  warn: { Icon: AlertTriangle, cls: "text-amber-500" },
  neutral: { Icon: Info, cls: "text-muted" },
};

/** Findings computed by fixed rules from the live answer; a week link opens the week panel. */
export function KeyInsights({ data, onSelectWeek }: { data: DashboardData; onSelectWeek: (w: string) => void }) {
  const list = useMemo(() => insights(data).slice(0, 3), [data]);
  return (
    <section className="dash-card">
      <CardHead title={tr("Key insights")} sub={`Based on the data of ${fmtDate(data.generated_at)}.`} />
      <ul className="grid gap-px border border-line bg-[var(--line)] md:grid-cols-3">
        {list.map((it) => {
          const { Icon, cls } = TONE[it.tone];
          const body = (
            <>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[color:var(--text)]">{it.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{it.detail}</span>
              </span>
              {it.week && <ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
            </>
          );
          return (
            <li key={it.title} className="bg-white">
              {it.week ? (
                <button type="button" className="row-btn group flex h-full items-start gap-3 p-4 hover:bg-accent-light" onClick={() => onSelectWeek(it.week!)}>
                  {body}
                </button>
              ) : (
                <div className="flex h-full items-start gap-3 p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ monthly breakdown */

/** `seasonId` comes from the Overview tab's own season picker, so this table always matches the KPI tiles above it. */
export function MonthlyTable({ data, seasonId }: { data: DashboardData; seasonId: string }) {
  const rows = useMemo(() => monthly(seasonDays(data, seasonId)), [data, seasonId]);
  const router = useRouter();
  const tot = rows.reduce(
    (t, r) => ({ a: t.a + (r.actual ?? 0), fc: t.fc + r.forecastCmp, py: t.py + r.previousYearCmp, f: t.f + r.forecast, p: t.p + r.previousYear }),
    { a: 0, fc: 0, py: 0, f: 0, p: 0 },
  );

  const exportCsv = () =>
    downloadCsv(
      `overnight-stays-by-month-${seasonId}.csv`,
      ["Month", "Days", "Days reported", "Actual", "Forecast", "Last year", "Actual vs forecast %", "Actual vs last year %", "Forecast vs last year %", "Occupancy %"],
      rows.map((r) => [r.month, r.days, r.daysWithActual, r.actual, r.forecast, r.previousYear, r.gapFcPct?.toFixed(1), r.gapPyPct?.toFixed(1), r.fcVsPyPct?.toFixed(1), r.occupancy === null ? null : (r.occupancy * 100).toFixed(1)]),
    );

  return (
    <section className="dash-card">
      <CardHead title={tr("Monthly breakdown")} sub={tr("Reported months compare actual stays with the forecast and last year on the same days. Future months compare the forecast with last year. Click a month to see why it changed.")}>
        <ExportButton onClick={exportCsv} />
      </CardHead>
      <div className="table-wrap dash-table">
        <table>
          <thead>
            <tr>
              <th>{tr("Month")}</th>
              <th className="num">{tr("Actual")}</th>
              <th className="num">{tr("Forecast")}</th>
              <th className="num">{tr("Last year")}</th>
              <th className="num">{tr("vs forecast")}</th>
              <th className="num">{tr("vs last year")}</th>
              <th className="num">{tr("Occupancy")}</th>
              <th><span className="sr-only">{tr("Explain")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = explainHref({ from: r.from, to: r.to }, "py");
              const go = () => router.push(href);
              return (
              <tr
                key={r.month}
                tabIndex={0}
                className="group"
                onClick={go}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    go();
                  }
                }}
                onMouseEnter={() => router.prefetch(href)}
                aria-label={`${monthName(r.month)}: explain why it changed`}
              >
                <td>
                  <div className="font-semibold">{monthName(r.month)}</div>
                  {r.daysWithActual > 0 && r.daysWithActual < r.days && <div className="text-xs text-muted">{r.daysWithActual} of {r.days} days reported</div>}
                </td>
                <td className="num">{fmtInt(r.actual)}</td>
                <td className="num">{fmtInt(r.forecast)}</td>
                <td className="num">{fmtInt(r.previousYear)}</td>
                <td className="num">{r.gapFcPct === null ? "–" : <GapChip pct={r.gapFcPct} />}</td>
                <td className="num">
                  {r.gapPyPct !== null ? (
                    <GapChip pct={r.gapPyPct} title={tr("actual vs last year")} />
                  ) : (
                    <>
                      <GapChip pct={r.fcVsPyPct} title={tr("forecast vs last year")} />
                      <div className="text-[10px] text-muted">{tr("forecast")}</div>
                    </>
                  )}
                </td>
                <td className="num">{fmtShare(r.occupancy, 0)}</td>
                <td>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted transition-colors group-hover:text-accent group-focus:text-accent">
                    {tr("Why?")}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--text)] font-bold">
              <td className="px-[0.875rem] py-[0.625rem]">{tr("Total")}</td>
              <td className="num px-[0.875rem]">{fmtInt(tot.a || null)}</td>
              <td className="num px-[0.875rem]">{fmtInt(tot.f)}</td>
              <td className="num px-[0.875rem]">{fmtInt(tot.p)}</td>
              <td className="num px-[0.875rem]">{tot.fc ? <GapChip pct={((tot.a - tot.fc) / tot.fc) * 100} /> : "–"}</td>
              <td className="num px-[0.875rem]">{tot.py ? <GapChip pct={((tot.a - tot.py) / tot.py) * 100} /> : tot.p ? <GapChip pct={((tot.f - tot.p) / tot.p) * 100} /> : "–"}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
