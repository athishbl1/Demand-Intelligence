"use client";

import { friendlyError } from "@/lib/errors";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, FileSearch, Play, Sunrise } from "lucide-react";
import { useAlerts } from "@/lib/useAlerts";
import { fmtDate } from "@/lib/dashboard";
import { checkRules, setAlertStatus, type Alert } from "@/lib/agent";
import { AlertList } from "@/components/agent/AlertList";
import { AlertRules } from "@/components/agent/AlertRules";
import { alertTone } from "@/components/agent/plain";
import { tr, useT } from "@/lib/i18n";

type Filter = "act" | "past" | "all";

const FILTERS: { id: Filter; label: string; test: (a: Alert) => boolean }[] = [
  { id: "act", label: "To act on", test: (a) => !!a.alert_type },
  { id: "past", label: "Past drops (explained)", test: (a) => !a.alert_type },
  { id: "all", label: "All", test: () => true },
];

export default function AlertsPage() {
  const t = useT();
  const [showDismissed, setShowDismissed] = useState(false);
  const a = useAlerts(showDismissed ? "dismissed" : "open");
  const [filter, setFilter] = useState<Filter>("act");
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const list = a.alerts.filter(FILTERS.find((f) => f.id === filter)!.test);
  const high = a.alerts.filter((x) => alertTone(x) === "high").length;
  const toAct = a.alerts.filter((x) => !!x.alert_type);
  const nextAct = toAct.map((x) => x.detail?.act_by).filter((d): d is string => !!d && d >= new Date().toISOString().slice(0, 10)).sort()[0] ?? null;

  const run = async () => {
    setRunning(true);
    setMsg(null);
    try {
      const r = await checkRules();
      a.refresh();
      setMsg({ kind: "ok", text: r.new_alerts ? t(r.new_alerts === 1 ? "{n} new alert to act on." : "{n} new alerts to act on.", { n: r.new_alerts }) : t("Checked all rules. No new alerts.") });
    } catch (err) {
      setMsg({ kind: "err", text: friendlyError(err) });
    } finally {
      setRunning(false);
    }
  };

  const dismiss = async (x: Alert) => {
    try {
      await setAlertStatus(x.id, "dismissed");
      a.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: friendlyError(err) });
    }
  };

  return (
    <div className="container-page flex flex-col gap-8 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <span className="eyebrow">{t("Agent alerts")}</span>
          <h1 className="page-title mt-3">{t("Alerts")}</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            {t("Alerts look ahead: they tell you which coming weeks need a campaign and by when. Pick what to watch below; n8n checks your rules every hour.")}
          </p>
        </div>
        <button type="button" className="btn" onClick={run} disabled={running}>
          {running ? <span className="spinner" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {running ? t("Checking …") : t("Check rules now")}
        </button>
      </header>

      {/* summary */}
      <dl className="grid grid-cols-2 gap-px border border-line bg-[var(--line)] lg:grid-cols-4">
        <Stat label={showDismissed ? t("Dismissed alerts") : t("To act on")} value={a.loading ? "–" : String(toAct.length)} sub="from your alert rules" />
        <Stat label="Unread" value={a.loading ? "–" : String(a.unread)} sub="not opened yet" accent={a.unread > 0} />
        <Stat label="High impact" value={a.loading ? "–" : String(high)} sub="look at these first" accent={high > 0} />
        <Stat label="Next act-by date" value={nextAct ? fmtDate(nextAct) : "–"} sub="earliest deadline in your alerts" small accent={!!nextAct} />
      </dl>

      <AlertRules />

      {msg && <div className={msg.kind === "ok" ? "notice text-sm" : "notice-error text-sm"} role="status">{msg.text}</div>}
      {a.error && (
        <div className="notice-error text-sm" role="alert">
          <b>{t("Alerts could not be loaded.")}</b> {friendlyError(a.error)}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line">
            <div className="flex gap-1" role="tablist" aria-label={t("Filter alerts")}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" role="tab" className="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
                  {t(f.label)}
                  <span className="text-slate-400">{a.alerts.filter(f.test).length}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
              <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />
              {t("Show dismissed")}
            </label>
          </div>

          {a.loading ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-28" />
              ))}
            </div>
          ) : (
            <AlertList alerts={list} onDismiss={dismiss} now={now} />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="border border-line bg-white p-5">
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em]">{t("How alerts work")}</p>
            <ol className="mt-4 flex flex-col gap-4">
              {[
                { Icon: BellRing, title: t("You choose"), text: t("Add alert rules above: what to watch and from which threshold.") },
                { Icon: CalendarClock, title: t("Every hour"), text: t("n8n checks the forecast for the coming weeks, school holidays and new bookings.") },
                { Icon: Sunrise, title: t("You act in time"), text: t("Each alert says what to do and the date to start, from how early guests book.") },
              ].map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-slate-900 text-white" aria-hidden="true">
                    <s.Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">
                      {i + 1}. {s.title}
                    </span>
                    <span className="block text-xs text-slate-600">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="border border-line bg-slate-50 p-5">
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em]">{t("Impact levels")}</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 bg-accent" />{t("High impact: act this week")}</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 bg-amber-500" />{t("Medium impact or data to check")}</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 bg-slate-400" />{t("For information")}</li>
            </ul>
          </div>
          <Link href="/explain" className="group flex items-center justify-between gap-3 border border-line bg-white p-5 text-inherit transition-shadow hover:shadow-[var(--shadow-premium)]">
            <span className="flex items-center gap-3">
              <FileSearch className="h-5 w-5 text-accent" aria-hidden="true" />
              <span>
                <span className="block text-sm font-bold">{t("Ask about any period")}</span>
                <span className="block text-xs text-slate-600">{t("Explain a day, week or range yourself.")}</span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent, small }: { label: string; value: string; sub: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="bg-white p-5">
      <dt className="kpi-label">{tr(label)}</dt>
      <dd className={`mt-1 font-display font-black tabular-nums ${small ? "text-xl" : "text-4xl"} ${accent ? "text-accent" : ""}`}>{value}</dd>
      <dd className="mt-1 text-xs text-muted">{tr(sub)}</dd>
    </div>
  );
}
