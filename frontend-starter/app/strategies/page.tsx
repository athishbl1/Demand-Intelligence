"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, FileSearch, Lightbulb, Rocket, TrendingUp } from "lucide-react";
import { fmtDate, fmtRange } from "@/lib/dashboard";
import { listSets, MODE_PLAIN, type SetStatus, type StrategySetSummary } from "@/lib/strategy";
import { relTime } from "@/components/agent/plain";

type Filter = "all" | SetStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "To decide" },
  { id: "accepted", label: "Chosen" },
  { id: "dismissed", label: "Dismissed" },
];

export default function StrategiesPage() {
  const t = useT();
  const [sets, setSets] = useState<StrategySetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  /** Set id the team just confirmed on a plan page (?confirmed=ID): highlighted in the board below. */
  const [confirmed, setConfirmed] = useState<number | null>(null);
  useEffect(() => {
    const c = Number(new URLSearchParams(window.location.search).get("confirmed"));
    if (Number.isInteger(c) && c > 0) setConfirmed(c);
  }, []);

  useEffect(() => {
    const c = new AbortController();
    listSets(c.signal)
      .then((r) => setSets(r.sets))
      .catch((e: unknown) => !c.signal.aborted && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !c.signal.aborted && setLoading(false));
    return () => c.abort();
  }, []);

  const list = sets.filter((s) => filter === "all" || s.status === filter);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sets.filter((s) => s.status !== "dismissed" && s.target?.launch_by >= today).sort((a, b) => a.target.launch_by.localeCompare(b.target.launch_by))[0];

  return (
    <div className="container-page flex flex-col gap-8 py-10 sm:py-14">
      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <span className="eyebrow">{t("Campaign strategist · AI agent")}</span>
          <h1 className="page-title mt-3">{t("Strategies")}</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            {t("Every explained drop or rise can become a campaign plan: up to three strategies for the next window that can still be won, plus your own idea. Choose one, and it is ready for the campaign builder.")}
          </p>
        </div>
        <Link href="/explain" className="btn">
          <FileSearch className="h-4 w-4" aria-hidden="true" />
          {t("Explain a period first")}
        </Link>
      </header>

      <ChosenBoard sets={sets} loading={loading} confirmed={confirmed} />

      <dl className="grid grid-cols-2 gap-px border border-line bg-[var(--line)] lg:grid-cols-4">
        <Stat label={t("Plans")} value={loading ? "–" : String(sets.length)} sub={t("one per explained period")} />
        <Stat label={t("To decide")} value={loading ? "–" : String(sets.filter((s) => s.status === "open" && s.count > 0).length)} sub={t("waiting for a choice")} accent />
        <Stat label={t("Chosen")} value={loading ? "–" : String(sets.filter((s) => s.status === "accepted").length)} sub={t("ready for Phase 4")} />
        <Stat label={t("Next launch")} value={upcoming ? fmtDate(upcoming.target.launch_by) : "–"} sub={upcoming ? t("for {x}", { x: upcoming.target.label }) : t("no upcoming launch")} small />
      </dl>

      {error && <div className="notice-error text-sm" role="alert"><b>{t("Plans could not be loaded.")}</b> {error}</div>}

      <div>
        <div className="mb-5 flex gap-1 border-b border-line" role="tablist" aria-label={t("Filter plans")}>
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" className="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
              {t(f.label)}
              <span className="text-slate-400">{sets.filter((s) => f.id === "all" || s.status === f.id).length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        ) : list.length === 0 ? (
          <div className="grid gap-6 border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
            <span className="flex h-14 w-14 items-center justify-center bg-accent text-white" aria-hidden="true"><Lightbulb className="h-7 w-7" /></span>
            <div>
              <h2 className="text-xl !normal-case">{t("No plans here yet")}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("Explain a period (for example 2027-W13, the week after Easter) and press “Suggest strategies” under the reasons.")}</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((s) => {
              const m = MODE_PLAIN[s.mode];
              const Icon = s.mode === "capitalise" ? TrendingUp : s.mode === "recover" ? Rocket : FileSearch;
              const chosen = s.status === "accepted" ? (s.accepted_idx === 3 ? s.custom_title : s.titles[s.accepted_idx ?? 0]) : null;
              return (
                <li key={s.set_id}>
                  <Link href={`/strategies/${s.set_id}`} className="group grid gap-4 border border-line bg-white p-5 text-inherit no-underline transition-shadow hover:shadow-[var(--shadow-premium)] sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <span className={`flex h-10 w-10 items-center justify-center text-white ${s.mode === "recover" ? "bg-accent" : "bg-slate-900"}`} aria-hidden="true"><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-display text-xs font-extrabold uppercase tracking-[0.1em]">{t(m.label)}</span>
                        <span className="text-sm font-semibold">{s.scope.label} → {s.target.label}</span>
                        {s.status === "accepted" && <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--delta-good)]"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{t("Chosen")}</span>}
                        {s.status === "dismissed" && <span className="text-xs font-semibold text-muted">{t("Dismissed")}</span>}
                        {s.version > 1 && <span className="text-xs text-muted">v{s.version}</span>}
                      </p>
                      <p className="mt-1 truncate text-[15px] text-slate-800">{chosen ? `${t("Chosen")}: ${chosen}` : s.headline}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted">
                        {s.target?.launch_by && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{t("Launch by")} {fmtDate(s.target.launch_by)}{s.target.late ? ` (${t("late")})` : ""}</span>}
                        <span>{t(s.count === 1 ? "{n} strategy" : "{n} strategies", { n: s.count })}{s.custom_title ? ` + ${t("your idea")}` : ""}</span>
                        <span>{relTime(s.created_at)}</span>
                      </p>
                    </div>
                    <ArrowRight className="hidden h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-accent sm:block" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent, small }: { label: string; value: string; sub: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <dt className="kpi-label">{label}</dt>
      <dd className={`mt-1 font-display font-extrabold tabular-nums ${small ? "text-lg" : "text-3xl"} ${accent && value !== "0" && value !== "–" ? "text-accent" : ""}`}>{value}</dd>
      <dd className="mt-0.5 text-xs text-muted">{sub}</dd>
    </div>
  );
}

/** The strategies dashboard: for every target week, the strategy the team chose, in week order. */
function ChosenBoard({ sets, loading, confirmed }: { sets: StrategySetSummary[]; loading: boolean; confirmed: number | null }) {
  const t = useT();
  const chosen = sets
    .filter((s) => s.status === "accepted" && s.accepted_idx !== null)
    .map((s) => ({ s, title: (s.accepted_idx === 3 ? s.custom_title : s.titles[s.accepted_idx ?? 0]) ?? "" }))
    .sort((a, b) => a.s.target.from.localeCompare(b.s.target.from));
  const just = chosen.find((c) => c.s.set_id === confirmed);

  useEffect(() => {
    if (just) document.getElementById(`chosen-${just.s.set_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [just]);

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-4">
      <div>
        <span className="eyebrow">{t("Strategy dashboard")}</span>
        <h2 id="board-title" className="mt-3 text-2xl sm:text-3xl">{t("Chosen strategy per week")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("Every plan you confirmed, by the week it targets.")}</p>
      </div>
      {just && (
        <div className="notice flex items-start gap-3 text-sm" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--delta-good)]" aria-hidden="true" />
          <span>
            <b>{t("Plan confirmed.")}</b> {t("“{title}” is now the strategy for {week}.", { title: just.title, week: just.s.target.label })}
          </span>
        </div>
      )}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="skeleton h-40" /><div className="skeleton h-40" /></div>
      ) : chosen.length === 0 ? (
        <p className="border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{t("No strategy chosen yet. Open a plan, choose one and confirm it to see it here.")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chosen.map(({ s, title }) => {
            const hot = s.set_id === confirmed;
            return (
              <li key={s.set_id} id={`chosen-${s.set_id}`}>
                <Link
                  href={`/strategies/${s.set_id}`}
                  className={`group flex h-full flex-col gap-3 border bg-white p-5 text-inherit no-underline transition-shadow hover:shadow-[var(--shadow-premium)] ${hot ? "border-[var(--delta-good)] shadow-[var(--shadow-premium)]" : "border-line"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{t("Target week")}</p>
                      <p className="font-display text-2xl font-black tabular-nums">{s.target.label}</p>
                      <p className="text-xs text-muted">{fmtRange(s.target.from, s.target.to)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-[var(--delta-good)] px-2 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("Chosen")}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug">{title}</p>
                  <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{t("Launch by")} {fmtDate(s.target.launch_by)}{s.target.late ? ` (${t("late")})` : ""}</span>
                    <span>{t("Based on {x}", { x: s.scope.label })}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
