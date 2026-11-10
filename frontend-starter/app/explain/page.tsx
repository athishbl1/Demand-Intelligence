"use client";

import { useT } from "@/lib/i18n";
import { friendlyError } from "@/lib/errors";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, ListChecks, MessageSquarePlus, Sparkles } from "lucide-react";
import { useExplanation } from "@/lib/useExplanation";
import type { ExplainQuery } from "@/lib/agent";
import { fmtDate } from "@/lib/dashboard";
import { MAX_RANGE_DAYS, rangeDays, splitRange, type RangePart } from "@/components/agent/links";
import { ExplainForm } from "@/components/agent/ExplainForm";
import { ExplanationView } from "@/components/agent/ExplanationView";

/** Reads ?date=, ?week=, ?from=&to= and ?compare=fc (deep links from the dashboard and the alerts). */
function queryFromUrl(): ExplainQuery | null {
  const p = new URLSearchParams(window.location.search);
  const compare = p.get("compare") === "fc" ? "fc" : "py";
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const week = p.get("week");
  if (week && /^\d{4}-W\d{2}$/.test(week)) return { scope: "week", week, compare };
  const date = p.get("date");
  if (date && iso.test(date)) return { scope: "day", date, compare };
  const from = p.get("from"),
    to = p.get("to");
  if (from && to && iso.test(from) && iso.test(to)) return { scope: "range", from, to, compare };
  return null;
}

function toUrl(q: ExplainQuery) {
  const p = new URLSearchParams();
  if (q.scope === "day") p.set("date", q.date);
  if (q.scope === "week") p.set("week", q.week);
  if (q.scope === "range") {
    p.set("from", q.from);
    p.set("to", q.to);
  }
  if (q.compare === "fc") p.set("compare", "fc");
  return `?${p.toString()}`;
}

const STEPS = [
  { Icon: BarChart3, title: "Compare", text: "Actual stays against the forecast and last year." },
  { Icon: ListChecks, title: "Explain", text: "Up to three reasons, each tied to facts from the data." },
  { Icon: MessageSquarePlus, title: "Improve", text: "Correct it, and it writes a new version." },
];

export default function ExplainPage() {
  const t = useT();
  const x = useExplanation();
  const [initial, setInitial] = useState<ExplainQuery | null>(null);
  /** A window longer than 92 days (e.g. a season from the dashboard), explained part by part. */
  const [parts, setParts] = useState<{ list: RangePart[]; active: number; compare: "py" | "fc" } | null>(null);
  /** Scroll to the reasons when the next answer arrives (deep links with ?why=1). */
  const [jumpToWhy, setJumpToWhy] = useState(false);
  const { ask } = x;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("why") === "1") setJumpToWhy(true);
    let q = queryFromUrl();
    if (q?.scope === "range" && rangeDays(q.from, q.to) > MAX_RANGE_DAYS) {
      const list = splitRange(q.from, q.to);
      const compare = q.compare ?? "py";
      setParts({ list, active: 0, compare });
      q = { scope: "range", from: list[0].from, to: list[0].to, compare };
    }
    if (q) {
      setInitial(q);
      ask(q);
    }
  }, [ask]);

  // Once the answer is in, bring the reasons (or the answer, if there are none) into view.
  useEffect(() => {
    if (!jumpToWhy || !x.data || x.busy) return;
    const target = document.getElementById(x.data.reasons.length ? "why" : "answer");
    if (target) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
    setJumpToWhy(false);
  }, [jumpToWhy, x.data, x.busy]);

  const onAsk = useCallback(
    (q: ExplainQuery) => {
      window.history.replaceState(null, "", toUrl(q));
      setParts((cur) => (cur && q.scope === "range" && cur.list.some((r) => r.from === q.from && r.to === q.to) ? cur : null));
      ask(q);
    },
    [ask],
  );

  const openPart = (i: number) => {
    if (!parts) return;
    const r = parts.list[i];
    const q: ExplainQuery = { scope: "range", from: r.from, to: r.to, compare: parts.compare };
    setParts({ ...parts, active: i });
    setInitial(q);
    setJumpToWhy(true);
    window.history.replaceState(null, "", `${toUrl(q)}&why=1`);
    ask(q);
  };

  return (
    <div className="container-page flex flex-col gap-8 py-10 sm:py-14">
      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <span className="eyebrow">{t("Change explainer · AI agent")}</span>
          <h1 className="page-title mt-3">{t("Why did stays change?")}</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            {t("Pick a day, a week or a date range. You get a plain answer, the numbers behind it and the reasons, ranked by how much of the change they explain.")}
          </p>
        </div>
        <ol className="grid gap-px border border-line bg-[var(--line)] sm:grid-cols-3 lg:w-[34rem]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-white p-4">
              <p className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.08em]">
                <span className="flex h-6 w-6 items-center justify-center bg-slate-900 text-[11px] text-white">{i + 1}</span>
                {t(s.title)}
              </p>
              <p className="mt-2 text-xs text-slate-600">{t(s.text)}</p>
            </li>
          ))}
        </ol>
      </header>

      <ExplainForm initial={initial} busy={x.busy !== null} onAsk={onAsk} />

      {parts && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border border-line border-l-[3px] border-l-accent bg-white px-5 py-4">
          <p className="min-w-0 flex-1 text-sm">
            <b>
              {t("This window runs {a} – {b} ({n} days).", { a: fmtDate(parts.list[0].from), b: fmtDate(parts.list[parts.list.length - 1].to), n: rangeDays(parts.list[0].from, parts.list[parts.list.length - 1].to) })}
            </b>{" "}
            <span className="text-slate-600">{t("The agent explains up to {max} days at a time, so it is split into {n} parts.", { max: MAX_RANGE_DAYS, n: parts.list.length })}</span>
          </p>
          <div className="seg" role="tablist" aria-label={t("Parts of the window")}>
            {parts.list.map((r, i) => (
              <button
                key={r.from}
                type="button"
                role="tab"
                className="seg-btn"
                aria-pressed={parts.active === i}
                aria-selected={parts.active === i}
                disabled={x.busy !== null}
                onClick={() => parts.active !== i && openPart(i)}
              >
                {t("Part")} {i + 1} · {fmtDate(r.from, false)} – {fmtDate(r.to, false)}
              </button>
            ))}
          </div>
        </div>
      )}

      {x.demo && (
        <div className="notice text-sm" role="status">
          <b>{t("The explainer is unavailable right now.")}</b> {t("Below is a saved example for week 2026-W16; please try again in a minute.")}
        </div>
      )}
      {x.error && !x.demo && (
        <div className="notice-error text-sm" role="alert">
          <b>{t("The explainer could not answer.")}</b> {friendlyError(x.error)}
        </div>
      )}

      {x.loading && !x.data && <LoadingState />}
      {x.data && <ExplanationView e={x.data} busy={x.busy} onOpen={x.open} onReanalyse={x.reanalyse} demo={x.demo} />}

      {!x.data && !x.loading && !x.error && <EmptyState />}
    </div>
  );
}

function LoadingState() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("Loading the explanation")}>
      <div className="flex items-center gap-3 border border-line bg-white px-5 py-4 text-sm">
        <span className="spinner text-accent" aria-hidden="true" />
        <span>
          <b>{t("The agent is working on it.")}</b> <span className="text-muted">{t("It checks the three numbers, then holidays, events, weather, bookings and free beds.")}</span>
        </span>
      </div>
      <div className="skeleton h-72" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-56" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="grid gap-6 border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
      <span className="flex h-14 w-14 items-center justify-center bg-accent text-white" aria-hidden="true">
        <Sparkles className="h-7 w-7" />
      </span>
      <div>
        <h2 className="text-xl !normal-case">{t("Choose a period above and press “Why?”")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {t("The answer starts with one sentence and one number, then shows how much of the change the forecast already expected, and up to three reasons with the facts behind them. Not sure where to start? Use a quick pick.")}
        </p>
      </div>
    </div>
  );
}
