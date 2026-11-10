"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { ArrowRight, CalendarClock, Gauge, LineChart, Target } from "lucide-react";
import { fmtDate } from "@/lib/dashboard";
import { formatNumber } from "@/lib/app";
import { MODE_PLAIN, type StrategySet } from "@/lib/strategy";
import { CHANGE_PLAIN } from "@/components/agent/plain";
import { TargetTimeline } from "./TargetTimeline";

/** Which gap the campaigns aim at: the forecast gap first, last year when actual is within ±5 % of the forecast. */
const BASIS_LABEL: Record<NonNullable<StrategySet["target"]["basis"]>, string> = {
  fc: "Target: gap vs forecast",
  py: "Target: gap vs last year",
  py_forecast: "Target: forecast vs last year",
};
const BASIS_HINT: Record<NonNullable<StrategySet["target"]["basis"]>, string> = {
  fc: "Actual differed from the forecast by more than 5 %, so the campaigns work on the gap to the forecast.",
  py: "Actual was within 5 % of the forecast, so the campaigns work on the change against last year.",
  py_forecast: "No actual stays yet, so the campaigns work on what the forecast expects against last year.",
};

/**
 * The plan in one card: mode, the future window the campaign aims at, when to launch, and how much room there is.
 * All values come from n8n's computations, not from the AI.
 */
export function StrategyHeader({ s, today }: { s: StrategySet; today: string }) {
  const tt = useT();
  const m = MODE_PLAIN[s.mode];
  const ex = s.explanation;
  const plain = CHANGE_PLAIN[ex.change_type];
  const t = s.target;
  const bar = s.mode === "recover" ? "var(--accent)" : s.mode === "capitalise" ? "var(--delta-good)" : "#a3a7ad";

  return (
    <section className="relative border border-line bg-white shadow-[var(--shadow-premium)]" aria-labelledby="plan-title">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: bar }} aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 pb-3 pt-5 sm:px-7">
        <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
          {tt("Campaign plan · based on {x}", { x: ex.scope.label })}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          {t.basis && (
            <span className="inline-flex items-center gap-1.5 border border-line px-2 py-1 text-xs font-bold" title={tt(BASIS_HINT[t.basis])}>
              <Target className="h-3 w-3" aria-hidden="true" />
              {tt(BASIS_LABEL[t.basis])}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 border border-line px-2 py-1 text-xs font-bold">
            <span className="h-2 w-2" style={{ background: bar }} aria-hidden="true" />
            {tt("Mode")}: {tt(m.label)}
          </span>
        </span>
      </div>

      <div className="grid gap-8 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.1em]" style={{ color: bar }}>
            {tt(m.title)}
          </p>
          <h2 id="plan-title" className="mt-2 max-w-3xl text-2xl !normal-case leading-tight sm:text-3xl">
            {s.headline || tt(m.text)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">{tt(m.text)}</p>

          <Link
            href={`/explain?${ex.scope.kind === "week" ? `week=${ex.scope.label}` : `from=${ex.scope.from}&to=${ex.scope.to}`}`}
            className="mt-5 flex max-w-3xl items-start gap-3 border-l-[3px] border-slate-900 bg-slate-50 px-4 py-3 text-sm text-inherit no-underline hover:bg-slate-100"
          >
            <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0">
              <b className="font-display text-xs uppercase tracking-[0.08em]">{tt("Why")} · {tt(plain.title)}</b>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {ex.reasons.map((r) => (
                  <span key={r.rank} className="inline-flex items-center gap-1.5 border border-line bg-white px-2 py-0.5 text-xs">
                    <span className="font-display font-black">{r.rank}</span>
                    {r.title}
                  </span>
                ))}
              </span>
            </span>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-px self-start border border-line bg-[var(--line)] lg:grid-cols-1">
          <div className="bg-white p-4">
            <dt className="kpi-label flex items-center gap-1.5"><Target className="h-3.5 w-3.5" aria-hidden="true" />{tt("Target window")}</dt>
            <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">{t.label}</dd>
            <dd className="text-xs text-muted">{fmtDate(t.from, false)} – {fmtDate(t.to)} · {t.alignment}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="kpi-label flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{tt("Launch by")}</dt>
            <dd className={`mt-1 font-display text-xl font-extrabold tabular-nums ${t.late ? "text-accent" : ""}`}>{fmtDate(t.launch_by)}</dd>
            <dd className="text-xs text-muted">{t.late ? tt("Ideal date {d} has passed", { d: fmtDate(t.ideal_launch) }) : tt("{n} days ahead, from booking lead time", { n: t.lead_days })}</dd>
          </div>
          {s.room && (
            <div className="col-span-2 bg-white p-4 lg:col-span-1">
              <dt className="kpi-label flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" aria-hidden="true" />{s.mode === "capitalise" ? tt("Extra demand to keep") : tt("Room to fill")}</dt>
              <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">{formatNumber(s.room.value)} {tt("stays")}</dd>
              <dd className="text-xs text-muted">{s.room.label}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="border-t border-line px-5 py-4 sm:px-7">
        <TargetTimeline timing={t} today={today} />
        {!t.has_forecast && (
          <p className="mt-2 text-xs text-muted">{tt("There is no forecast for this window yet (it ends on 4 Apr 2027): the plan uses holidays, events and booking habits.")}</p>
        )}
      </div>
    </section>
  );
}
