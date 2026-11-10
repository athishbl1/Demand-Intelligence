"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarRange, Zap } from "lucide-react";
import { fmtDate } from "@/lib/dashboard";
import { Segmented } from "@/components/dash/bits";
import { ACTUALS_END, DATA_FROM, DATA_TO, isoWeekOf, type ExplainQuery, type ScopeKind } from "@/lib/agent";

/** Question builder: day, ISO week or range, compared with last year or the forecast. The crimson button asks "Why?". */
export function ExplainForm({ initial, busy, onAsk }: { initial: ExplainQuery | null; busy: boolean; onAsk: (q: ExplainQuery) => void }) {
  const t = useT();
  const [kind, setKind] = useState<ScopeKind>("week");
  const [date, setDate] = useState("2026-04-15");
  const [from, setFrom] = useState("2026-04-06");
  const [to, setTo] = useState("2026-04-19");
  // Both comparisons are always explained (forecast first, then last year); a ?compare= from old links is passed through.
  const [compare, setCompare] = useState<"py" | "fc">("py");

  useEffect(() => {
    if (!initial) return;
    setKind(initial.scope);
    if (initial.compare) setCompare(initial.compare);
    if (initial.scope === "day") setDate(initial.date);
    if (initial.scope === "week") setDate(weekMonday(initial.week));
    if (initial.scope === "range") {
      setFrom(initial.from);
      setTo(initial.to);
    }
  }, [initial]);

  const week = isoWeekOf(date);
  const monday = weekMonday(week);
  const sunday = addDays(monday, 6);
  const rangeError = kind === "range" && (to < from ? t("The end must be on or after the start.") : daysBetween(from, to) > 91 ? t("A range can be at most 92 days.") : null);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (rangeError) return;
    if (kind === "day") onAsk({ scope: "day", date, compare });
    else if (kind === "week") onAsk({ scope: "week", week, compare });
    else onAsk({ scope: "range", from, to, compare });
  };

  const quick = (w: string) => {
    setKind("week");
    setDate(weekMonday(w));
    onAsk({ scope: "week", week: w, compare });
  };
  const lastReported = isoWeekOf(ACTUALS_END);
  const picks = [
    { week: lastReported, label: t("Last reported week") },
    { week: "2026-W14", label: t("Easter week 2026") },
    { week: "2026-W16", label: t("Two weeks after Easter") },
  ];

  const summary =
    kind === "day"
      ? fmtDate(date)
      : kind === "week"
        ? `${t("Week")} ${week} · ${fmtDate(monday, monday.slice(0, 4) !== sunday.slice(0, 4))} – ${fmtDate(sunday)}`
        : `${fmtDate(from)} – ${fmtDate(to)} · ${t("{n} days", { n: Math.max(0, daysBetween(from, to) + 1) })}`;

  return (
    <form className="border border-line bg-white shadow-[var(--shadow-premium)]" onSubmit={submit} aria-label={t("Ask the agent")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-[0.06em]">
          <CalendarRange className="h-4 w-4 text-accent" aria-hidden="true" />
          {t("Ask about a period")}
        </p>
        <p className="text-xs text-muted">
          {t("Data from {a} to {b} · actual stays until {c}", { a: fmtDate(DATA_FROM), b: fmtDate(DATA_TO), c: fmtDate(ACTUALS_END) })}
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[auto_1fr_auto] lg:items-end">
        <div>
          <p className="label">{t("Explain a")}</p>
          <Segmented
            label={t("Period")}
            value={kind}
            onChange={setKind}
            options={[
              { id: "day", label: t("Day") },
              { id: "week", label: t("Week") },
              { id: "range", label: t("Range") },
            ]}
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-end gap-3">
          {kind !== "range" ? (
            <div className="min-w-[12rem] flex-1">
              <label className="label" htmlFor="ex-date">{kind === "day" ? t("Day") : t("Any day in the week")}</label>
              <input id="ex-date" type="date" className="field" min={DATA_FROM} max={DATA_TO} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          ) : (
            <>
              <div className="min-w-[10rem] flex-1">
                <label className="label" htmlFor="ex-from">{t("From")}</label>
                <input id="ex-from" type="date" className="field" min={DATA_FROM} max={DATA_TO} value={from} onChange={(e) => setFrom(e.target.value)} required />
              </div>
              <div className="min-w-[10rem] flex-1">
                <label className="label" htmlFor="ex-to">{t("To")}</label>
                <input id="ex-to" type="date" className="field" min={DATA_FROM} max={DATA_TO} value={to} onChange={(e) => setTo(e.target.value)} required />
              </div>
            </>
          )}
        </div>

        <button type="submit" className="btn w-full lg:w-auto" disabled={busy || !!rangeError}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {busy ? t("Analysing …") : t("Why?")}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-slate-50 px-5 py-3 sm:px-7">
        <p className="text-sm">
          <span className="text-muted">{t("You are asking about")} </span>
          <b className="tabular-nums">{summary}</b>
          <span className="text-muted">, {t("against the forecast first, then last year")}.</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Quick picks")}
          </span>
          {picks.map((p) => (
            <button
              key={p.week}
              type="button"
              onClick={() => quick(p.week)}
              disabled={busy}
              className="border border-line bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:opacity-50"
              title={`${t("Week")} ${p.week}`}
            >
              {p.label} <span className="text-muted tabular-nums">{p.week.slice(-3)}</span>
            </button>
          ))}
        </div>
      </div>
      {rangeError && <p className="notice-error mx-5 mb-4 text-sm sm:mx-7">{rangeError}</p>}
    </form>
  );
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekMonday(w: string) {
  const [y, n] = w.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (n - 1) * 7);
  return mon.toISOString().slice(0, 10);
}
