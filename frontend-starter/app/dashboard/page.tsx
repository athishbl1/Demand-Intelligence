"use client";

import { useT, useLang } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, Pause, Play, RefreshCw, Table2 } from "lucide-react";
import { OVERVIEW_SEASONS, fmtDate, type DashboardData } from "@/lib/dashboard";
import { ago, useLiveDashboard, useNow } from "@/components/landing/useLive";
import { KpiTiles } from "@/components/dash/KpiTiles";
import { BiggestGaps } from "@/components/dash/OverviewCards";
import { KeyInsights, MonthlyTable } from "@/components/dash/OverviewExtras";
import { WeeksTable } from "@/components/dash/WeeksTable";
import { HolidayCalendar } from "@/components/dash/HolidayCalendar";
import { WeekPanel } from "@/components/dash/WeekPanel";
import { Segmented } from "@/components/dash/bits";

type Tab = "overview" | "weeks" | "calendar";

const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", Icon: BarChart3 },
  { id: "weeks", label: "Weeks", Icon: Table2 },
  { id: "calendar", label: "Holidays", Icon: CalendarDays },
];

function timeOf(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

const REFRESH_MS = 60_000;

export default function DashboardPage() {
  const { t, locale } = useLang();
  const [auto, setAuto] = useState(true);
  const { loading, data, source, error, refresh, updatedAt } = useLiveDashboard(REFRESH_MS, auto);
  const now = useNow(1000);
  const nextIn = auto && now !== null && updatedAt !== null ? Math.max(0, Math.ceil((updatedAt + REFRESH_MS - now) / 1000)) : null;
  const [tab, setTab] = useState<Tab>("overview");
  /** Season the Overview tab's tiles, movers and monthly table are generated for. */
  const [overviewSeason, setOverviewSeason] = useState("w2627");
  const [week, setWeek] = useState<string | null>(null);
  const closeWeek = useCallback(() => setWeek(null), []);

  // Deep links for the demo: /dashboard#calendar opens a tab, ?week=2026-W16 opens a week.
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === hash)) setTab(hash);
    const sid = new URLSearchParams(window.location.search).get("season");
    if (sid && OVERVIEW_SEASONS.some((x) => x.id === sid)) setOverviewSeason(sid);
    const w = new URLSearchParams(window.location.search).get("week");
    if (w && /^\d{4}-W\d{2}$/.test(w)) setWeek(w);
  }, []);

  const selectTab = (id: Tab) => {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="container-page flex flex-col gap-6 py-10 sm:py-14">
      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="eyebrow">TVB Paznaun-Ischgl · {t("Demand Detective")}</span>
          <h1 className="page-title mt-3">{t("Season dashboard")}</h1>
          <p className="dash-sub mt-3 max-w-2xl">{t("Overnight stays against forecast and last year, and what is behind the gaps.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {source && (
            <span className="source-pill" title={source === "demo" ? t("Live data is unavailable; showing the last saved copy") : t("Data as of {x}", { x: timeOf(data?.generated_at ?? "", locale) })}>
              <span className="relative flex h-2 w-2">
                {source === "live" && auto && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "var(--status-good)" }} />}
                <span className="source-dot relative" style={{ background: source === "live" ? "var(--status-good)" : "var(--status-warning)" }} />
              </span>
              {source === "live" ? t("Live data") : t("Saved copy")}
              <span className="font-medium text-muted" aria-live="polite">
                · {t("updated")} {ago(now, updatedAt)}
                {nextIn !== null && !loading ? ` · ${t("next in {n} s", { n: nextIn })}` : ""}
              </span>
            </span>
          )}
          <button
            type="button"
            className="seg-btn !min-h-12 !px-3"
            onClick={() => setAuto((a) => !a)}
            aria-pressed={auto}
            title={auto ? t("Pause automatic refresh") : t("Refresh automatically every minute")}
          >
            {auto ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            <span className="sr-only">{auto ? t("Pause auto-refresh") : t("Resume auto-refresh")}</span>
          </button>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            {loading ? t("Loading …") : t("Refresh")}
          </button>
        </div>
      </div>

      {source === "demo" && error && (
        <div className="notice text-sm" role="status">
          <b>{t("Live data is unavailable right now.")}</b> {t("You are looking at the last saved copy; the page retries automatically.")}
        </div>
      )}
      {!data && !loading && error && (
        <div className="notice-error" role="alert">
          <b>{t("The dashboard could not be loaded.")}</b> {t("Please check your connection and press Refresh.")}
        </div>
      )}

      {!data && loading && <LoadingSkeleton />}

      {data && (
        <>
          <div className="tab-list" role="tablist" aria-label={t("Dashboard views")}>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className="tab"
                onClick={() => selectTab(id)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(label)}
                <TabBadge id={id} data={data} />
              </button>
            ))}
          </div>

          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4" aria-busy={loading}>
            {tab === "overview" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="dash-sub">{t("Generated for")}</p>
                  <Segmented
                    label="Season"
                    value={overviewSeason}
                    onChange={setOverviewSeason}
                    options={OVERVIEW_SEASONS.map((s) => ({ id: s.id, label: s.label }))}
                  />
                </div>
                <KpiTiles data={data} seasonId={overviewSeason} />
                <KeyInsights data={data} onSelectWeek={setWeek} />
                <BiggestGaps data={data} seasonId={overviewSeason} onSelectWeek={setWeek} />
                <MonthlyTable data={data} seasonId={overviewSeason} />
              </>
            )}
            {tab === "weeks" && <WeeksTable data={data} onSelectWeek={setWeek} />}
            {tab === "calendar" && <HolidayCalendar data={data} onSelectWeek={setWeek} />}
          </div>

          <p className="text-xs text-muted">
            {t("Actuals reported until {d}.", { d: fmtDate(data.quality.last_actual) })} {t("Sources")}: {data.sources.join(" · ")}.
          </p>
        </>
      )}

      {data && week && <WeekPanel data={data} week={week} onClose={closeWeek} />}
    </div>
  );
}

/** Live count next to a tab label, taken from the current data. */
function TabBadge({ id, data }: { id: Tab; data: DashboardData }) {
  const t = useT();
  let text: string | null = null;
  if (id === "weeks") text = String(data.weeks.length);
  if (id === "calendar") {
    const ref = data.generated_at.slice(0, 10);
    const next = data.weeks.find((w) => w.week_end >= ref && Object.values(data.holidays_by_week?.[w.week]?.markets ?? {}).some((m) => m.coverage >= 0.5));
    text = next ? next.week.slice(-3) : null;
  }
  if (!text) return null;
  return (
    <span
      className={`ml-0.5 inline-flex min-w-5 items-center justify-center px-1.5 py-0.5 text-[10px] font-extrabold leading-none tabular-nums bg-surface-muted text-[color:var(--text)]`}
      title={id === "weeks" ? t("Weeks in the answer") : t("Next week with a major market on holiday")}
    >
      {text}
    </span>
  );
}

function LoadingSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("Loading dashboard")}>
      <div className="skeleton h-11" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-[260px]" />
      <p className="dash-sub">{t("Loading the latest numbers …")}</p>
    </div>
  );
}
