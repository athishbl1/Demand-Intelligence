"use client";

import { ArrowDownRight, ArrowUpRight, Database, Minus } from "lucide-react";
import { fmtDate, fmtInt } from "@/lib/dashboard";
import type { Explanation } from "@/lib/agent";
import { useT } from "@/lib/i18n";
import { CHANGE_PLAIN, SEVERITY_PLAIN, TONE_BAR, deltaWords, dirTone, signedPct } from "./plain";

/**
 * The answer in one card: a plain verdict, the main change as one big number, the three figures
 * as sentences, and how the change splits into "expected" and "surprise". No AI in these numbers.
 */
export function ChangeSummary({ e, children, hideSeverity }: { e: Explanation; children?: React.ReactNode; hideSeverity?: boolean }) {
  const tt = useT();
  const t = e.totals;
  const hasAct = t.days_with_actual > 0;
  const plain = CHANGE_PLAIN[e.change_type];
  const sev = e.severity ? SEVERITY_PLAIN[e.severity] : null;
  const tone = dirTone(e.change_type);
  const Icon = tone === "down" ? ArrowDownRight : tone === "up" ? ArrowUpRight : tone === "data" ? Database : Minus;
  const color = tone === "down" ? "var(--delta-bad)" : tone === "up" ? "var(--delta-good)" : "var(--text-muted)";
  const period = `${fmtDate(e.scope.from)}${e.scope.to !== e.scope.from ? ` – ${fmtDate(e.scope.to)}` : ""}`;

  const expected = e.parts?.expected;
  const miss = e.parts?.miss;
  const showSplit = hasAct && expected && miss && expected.share_pct + miss.share_pct > 0;

  return (
    <section id="answer" className="relative scroll-mt-24 border border-line bg-white shadow-[var(--shadow-premium)]" aria-labelledby="verdict-title">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: sev ? TONE_BAR[sev.tone] : "var(--accent)" }} aria-hidden="true" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 pb-3 pt-5 sm:px-7">
        <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
          {tt("The answer")} · {e.scope.label}
          {e.scope.label !== fmtDate(e.scope.from) && e.scope.label.replace(/\s/g, "") !== period.replace(/\s/g, "") && ` · ${period}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {sev && !hideSeverity && <SeverityPill severity={e.severity!} />}
          {children}
        </div>
      </div>

      <div className="grid gap-8 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.1em]" style={{ color }}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tt(plain.title)}
          </p>
          <h2 id="verdict-title" className="mt-2 max-w-3xl text-2xl !normal-case leading-tight sm:text-3xl">
            {e.headline || tt(plain.meaning)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">{tt(plain.meaning)}</p>
        </div>
        {/* the two percentages that matter: against last year and against the forecast */}
        <div className="grid gap-6 lg:gap-10">
          {hasAct ? (
            // Actual vs last year moved down to "How the change adds up" (DriverBreakdown), next to its split.
            <BigPct pct={t.gap_fc_pct} label={tt("actual vs forecast")} />
          ) : (
            <>
              <BigPct pct={t.fc_vs_py_pct} label={tt("forecast vs last year")} />
            </>
          )}
        </div>
      </div>

      {/* the three figures, as sentences */}
      <dl className="grid border-t border-line sm:grid-cols-3">
        <Figure
          label={tt("Actual stays")}
          value={hasAct ? fmtInt(t.actual) : tt("Not reported yet")}
          note={hasAct ? tt("{a} of {b} days reported", { a: t.days_with_actual, b: t.days }) : tt("Later periods are explained from the forecast")}
        />
        <Figure
          label={tt("Forecast")}
          value={fmtInt(hasAct ? t.forecast_cmp : t.forecast)}
          note={hasAct ? tt("Actual was {x}", { x: deltaWords(t.gap_fc_pct, "the forecast") }) : tt("Forecast is {x}", { x: deltaWords(t.fc_vs_py_pct, "last year") })}
          tone={hasAct ? t.gap_fc_pct : t.fc_vs_py_pct}
          border
        />
        <Figure
          label={tt("Same days last year")}
          value={fmtInt(hasAct ? t.previous_year_cmp : t.previous_year)}
          note={hasAct ? tt("Actual was {x}", { x: deltaWords(t.gap_py_pct, "last year") }) : tt("Reference for the forecast")}
          tone={hasAct ? t.gap_py_pct : null}
          border
        />
      </dl>

      {/* expected vs surprise */}
      {showSplit && (
        <div className="border-t border-line px-5 py-5 sm:px-7">
          <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">{tt("How the change splits")}</p>
          <div
            className="mt-3 flex h-3 w-full overflow-hidden bg-surface-muted"
            role="img"
            aria-label={tt("{a} % expected by the forecast, {b} % a surprise", { a: expected!.share_pct, b: miss!.share_pct })}
          >
            <span className="h-full bg-[var(--bar-ink)]" style={{ width: `${expected!.share_pct}%` }} />
            <span className="h-full bg-accent" style={{ width: `${miss!.share_pct}%` }} />
          </div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 bg-[var(--bar-ink)]" aria-hidden="true" />
              <span>
                <b className="tabular-nums">{expected!.share_pct} %</b> {tt("was already in the forecast")}
                <span className="block text-xs text-muted tabular-nums">{fmtSigned(expected!.value)} {tt("stays: forecast vs last year")}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 bg-accent" aria-hidden="true" />
              <span>
                <b className="tabular-nums">{miss!.share_pct} %</b> {tt("was a surprise")}
                <span className="block text-xs text-muted tabular-nums">{fmtSigned(miss!.value)} {tt("stays: actual vs forecast")}</span>
              </span>
            </p>
          </div>
          {e.unexplained_pct !== null && e.unexplained_pct !== undefined && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              {e.unexplained_pct === 0
                ? tt("Every part of this change is covered by a reason backed by data.")
                : tt("{n} % of the change is not covered by a reason backed by data.", { n: e.unexplained_pct })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const fmtSigned = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtInt(Math.abs(v))}`;

function Figure({ label, value, note, tone, border }: { label: string; value: string; note: string; tone?: number | null; border?: boolean }) {
  const c = tone === null || tone === undefined || Math.abs(tone) < 0.5 ? "text-muted" : tone < 0 ? "delta-bad" : "delta-good";
  return (
    <div className={`px-5 py-4 sm:px-7 ${border ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
      <dt className="kpi-label">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</dd>
      <dd className={`mt-0.5 text-sm font-semibold ${c}`}>{note}</dd>
    </div>
  );
}

/** One big percentage with its label; red when below, green when above, grey when level. */
function BigPct({ pct, label }: { pct: number | null | undefined; label: string }) {
  const c = pct === null || pct === undefined || Math.abs(pct) < 0.5 ? "var(--text-muted)" : pct < 0 ? "var(--delta-bad)" : "var(--delta-good)";
  return (
    <div className="flex flex-col lg:items-end">
      <span className="font-display text-4xl font-black leading-none tabular-nums sm:text-5xl" style={{ color: c }}>
        {signedPct(pct)}
      </span>
      <span className="mt-1.5 text-sm text-muted lg:text-right">{label}</span>
    </div>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const t = useT();
  const s = SEVERITY_PLAIN[severity];
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 border border-line px-2 py-1 text-xs font-bold">
      <span className="h-2 w-2" style={{ background: TONE_BAR[s.tone] }} aria-hidden="true" />
      {t(s.label)}
    </span>
  );
}
