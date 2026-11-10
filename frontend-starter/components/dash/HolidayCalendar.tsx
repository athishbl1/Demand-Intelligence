"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { MAIN_SEASONS, MARKETS, fmtInt, fmtRange, fmtSignedPct, inSeason } from "@/lib/dashboard";
import { CardHead, Segmented } from "./bits";
import { UpcomingHolidays } from "./HolidayExtras";

/** Sequential blue ramp for holiday coverage (0 = no holiday). */
function coverageColor(c: number): string {
  if (c <= 0) return "var(--surface-muted)";
  if (c < 0.25) return "var(--seq-100)";
  if (c < 0.5) return "var(--seq-200)";
  if (c < 0.75) return "var(--seq-400)";
  return "var(--seq-550)";
}

const STEPS = [
  { label: "none", c: 0 },
  { label: "< 25 %", c: 0.1 },
  { label: "25–50 %", c: 0.3 },
  { label: "50–75 %", c: 0.6 },
  { label: "≥ 75 %", c: 0.9 },
];

const SEASON_OPTIONS = MAIN_SEASONS;

interface Tip {
  title: string;
  lines: string[];
  /** Key of the hovered cell ("week" or "week:market"), for the outline. */
  key: string;
  week: string;
  /** Anchor inside the scroll container: centre x, top and bottom y of the hovered cell. */
  x: number;
  top: number;
  bottom: number;
}

const TIP_HALF_WIDTH = 130; // half of .viz-tooltip max-width

/** Holiday names without case-only duplicates ("Christmas holidays" / "Christmas Holidays"). */
function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((n) => {
    const k = n.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function HolidayCalendar({ data, onSelectWeek }: { data: DashboardData; onSelectWeek: (w: string) => void }) {
  const [seasonId, setSeasonId] = useState("w2627");
  const [tip, setTip] = useState<Tip | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** Show a tooltip anchored to the hovered (or focused) cell, kept inside the visible part of the grid. */
  const show = (el: HTMLElement, t: Pick<Tip, "title" | "lines" | "key" | "week">) => {
    const box = scrollRef.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const minX = box.scrollLeft + TIP_HALF_WIDTH + 4;
    const maxX = box.scrollLeft + box.clientWidth - TIP_HALF_WIDTH - 4;
    const cx = r.left - b.left + box.scrollLeft + r.width / 2;
    setTip({ ...t, x: Math.min(Math.max(cx, minX), Math.max(minX, maxX)), top: r.top - b.top + box.scrollTop, bottom: r.bottom - b.top + box.scrollTop });
  };
  const season = SEASON_OPTIONS.find((s) => s.id === seasonId) ?? SEASON_OPTIONS[0];
  const weeks = useMemo(() => data.weeks.filter((w) => inSeason(w.week_start, season)), [data, season]);
  const hol = data.holidays_by_week ?? {};
  const ev = data.events_by_week ?? {};
  const markets = MARKETS.filter((m) => weeks.some((w) => hol[w.week]?.markets?.[m.code]));
  const maxFc = Math.max(1, ...weeks.map((w) => w.forecast ?? 0));

  const cols = `92px repeat(${weeks.length}, minmax(26px, 1fr))`;

  return (
    <div className="flex flex-col gap-4">
    <section className="dash-card">
      <CardHead
        title={tr("Holiday & event calendar")}
        sub={tr("School holidays in the source markets per week, next to the forecast and top events. Click a week for details.")}
      >
        <Segmented label={tr("Season")} value={seasonId} onChange={setSeasonId} options={SEASON_OPTIONS.map((s) => ({ id: s.id, label: s.label }))} />
      </CardHead>

      <div
        ref={scrollRef}
        className="relative overflow-x-auto pb-2"
        onMouseLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
        onScroll={() => setTip(null)}
      >
        <div className="grid min-w-[760px] items-center gap-[3px]" style={{ gridTemplateColumns: cols }}>
          {/* header row: week numbers */}
          <div className="text-[11px] font-semibold text-muted">{tr("Week")}</div>
          {weeks.map((w) => (
            <div
              key={w.week}
              className={`text-center text-[10px] font-semibold tabular-nums transition-colors ${tip?.week === w.week ? "text-accent" : "text-muted"}`}
            >
              {w.week.slice(-2)}
            </div>
          ))}

          {/* forecast load row */}
          <div className="text-[11px] font-semibold">{tr("Forecast load")}</div>
          {weeks.map((w) => {
            const h = Math.max(2, ((w.forecast ?? 0) / maxFc) * 34);
            const g = w.days_with_actual > 0 ? w.gap_py_pct : w.fc_vs_py_pct;
            return (
              <button
                key={w.week}
                type="button"
                className="flex h-9 items-end justify-center border-0 bg-transparent p-0"
                onClick={() => onSelectWeek(w.week)}
                onMouseEnter={(e) =>
                  show(e.currentTarget, {
                    key: w.week,
                    week: w.week,
                    title: `${w.week} · ${fmtRange(w.week_start, w.week_end)}`,
                    lines: [`Forecast ${fmtInt(w.forecast)}`, `Last year ${fmtInt(w.previous_year)} (${fmtSignedPct(g)})`],
                  })
                }
                onFocus={(e) =>
                  show(e.currentTarget, {
                    key: w.week,
                    week: w.week,
                    title: `${w.week} · ${fmtRange(w.week_start, w.week_end)}`,
                    lines: [`Forecast ${fmtInt(w.forecast)}`, `Last year ${fmtInt(w.previous_year)} (${fmtSignedPct(g)})`],
                  })
                }
                aria-label={`${w.week}: forecast ${fmtInt(w.forecast)}`}
              >
                <span className="block w-full max-w-[18px]" style={{ height: h, background: "var(--viz-forecast)", opacity: 0.75 }} />
              </button>
            );
          })}

          {/* one row per market */}
          {markets.map((m) => (
            <Row key={m.code} label={`${m.code} · ${m.name}`}>
              {weeks.map((w) => {
                const mh = hol[w.week]?.markets?.[m.code];
                const c = mh?.coverage ?? 0;
                const key = `${w.week}:${m.code}`;
                const t = {
                  key,
                  week: w.week,
                  title: `${m.name} · ${w.week}`,
                  lines: mh ? [`${Math.round(c * 100)} % of regions on holiday`, ...uniqueNames(mh.names)] : ["no school holiday"],
                };
                return (
                  <button
                    key={w.week}
                    type="button"
                    className="heat-cell"
                    style={{
                      background: coverageColor(c),
                      boxShadow: tip?.key === key ? "inset 0 0 0 2px var(--text)" : undefined,
                    }}
                    onClick={() => onSelectWeek(w.week)}
                    onMouseEnter={(e) => show(e.currentTarget, t)}
                    onFocus={(e) => show(e.currentTarget, t)}
                    aria-label={`${m.name}, ${w.week}: ${mh ? `${Math.round(c * 100)} % on school holiday` : "no school holiday"}`}
                  />
                );
              })}
            </Row>
          ))}

          {/* top events */}
          <div className="text-[11px] font-semibold">{tr("Top events")}</div>
          {weeks.map((w) => {
            const top = ev[w.week]?.top ?? [];
            return (
              <div
                key={w.week}
                className="flex h-6 items-center justify-center"
                onMouseEnter={(e) => {
                  if (!top.length) return;
                  show(e.currentTarget, {
                    key: `${w.week}:events`,
                    week: w.week,
                    title: `Top events · ${w.week}`,
                    lines: top.map((t) => `${t.name}${t.village ? ` (${t.village})` : ""}`),
                  });
                }}
              >
                {top.length > 0 && (
                  <svg width="12" height="12" aria-label={`${top.length} top events`}>
                    <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="var(--viz-ink-2)" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {tip && (
          <div
            className="viz-tooltip"
            style={
              // Above the cell; below it for the top rows, where there is no room above.
              tip.top < 110
                ? { left: tip.x, top: tip.bottom + 8, transform: "translateX(-50%)" }
                : { left: tip.x, top: tip.top - 8, transform: "translate(-50%, -100%)" }
            }
            aria-live="polite"
          >
            <div className="mb-1 font-semibold">{tip.title}</div>
            {tip.lines.map((l, i) => (
              <div key={i} className="text-muted">{l}</div>
            ))}
          </div>
        )}
      </div>

      <div className="legend mt-3">
        <span className="font-semibold">{tr("School-holiday coverage:")}</span>
        {STEPS.map((s) => (
          <span key={s.label} className="legend-item">
            <span className="legend-swatch" style={{ background: coverageColor(s.c), outline: "1px solid var(--line)" }} />
            {s.label}
          </span>
        ))}
        <span className="legend-item">
          <svg width="10" height="10" aria-hidden="true"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="var(--viz-ink-2)" /></svg>
          {tr("top event")}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">Holidays: OpenHolidays (ODbL); UK dates hardcoded and approximate. Denmark returns no data from the source.</p>
    </section>

    <UpcomingHolidays data={data} onSelectWeek={onSelectWeek} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="truncate text-[11px] font-semibold" title={label}>{label}</div>
      {children}
    </>
  );
}
