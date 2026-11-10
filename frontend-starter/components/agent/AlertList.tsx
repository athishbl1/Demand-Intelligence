"use client";

import Link from "next/link";
import { ArrowRight, BellOff, X } from "lucide-react";
import { fmtDate } from "@/lib/dashboard";
import { ruleInfo, type Alert } from "@/lib/agent";
import { actByText, ruleValue } from "./AlertRules";
import { CHANGE_PLAIN, SEVERITY_PLAIN, TONE_BAR, alertTone, dirTone, relTime, signedPct } from "./plain";

/** Inbox grouped into "needs attention" (unread) and "earlier"; each alert is one readable card. */
export function AlertList({ alerts, onDismiss, now }: { alerts: Alert[]; onDismiss: (a: Alert) => void; now: number }) {
  if (!alerts.length) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center bg-white text-slate-500 shadow-[var(--shadow-premium)]" aria-hidden="true">
          <BellOff className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-extrabold uppercase">All clear</p>
        <p className="max-w-md text-sm text-slate-600">No alerts in this view. Nothing in the coming weeks crosses your thresholds right now.</p>
      </div>
    );
  }
  const fresh = alerts.filter((a) => a.status === "unread");
  const rest = alerts.filter((a) => a.status !== "unread");
  return (
    <div className="flex flex-col gap-8">
      {fresh.length > 0 && <Group title="Needs your attention" count={fresh.length} alerts={fresh} onDismiss={onDismiss} now={now} />}
      {rest.length > 0 && <Group title={fresh.length ? "Earlier" : "Alerts"} count={rest.length} alerts={rest} onDismiss={onDismiss} now={now} />}
    </div>
  );
}

function Group({ title, count, alerts, onDismiss, now }: { title: string; count: number; alerts: Alert[]; onDismiss: (a: Alert) => void; now: number }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-slate-600">
        {title}
        <span className="bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">{count}</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {alerts.map((a) => (
          <AlertCard key={a.id} a={a} onDismiss={onDismiss} now={now} />
        ))}
      </ul>
    </section>
  );
}

function AlertCard({ a, onDismiss, now }: { a: Alert; onDismiss: (a: Alert) => void; now: number }) {
  const tone = alertTone(a);
  const dir = dirTone(a.change_type);
  const rule = ruleInfo(a.alert_type);
  const act = actByText(a.detail?.act_by);
  const plain = rule ? { title: rule.label, meaning: "" } : CHANGE_PLAIN[a.change_type];
  const sev = SEVERITY_PLAIN[a.severity];
  const pct = a.delta_pct === null ? null : Number(a.delta_pct);
  const color = dir === "down" ? "var(--delta-bad)" : dir === "up" ? "var(--delta-good)" : "var(--text-muted)";
  const unread = a.status === "unread";

  return (
    <li className={`group relative flex border bg-white transition-shadow hover:shadow-[var(--shadow-premium)] ${unread ? "border-slate-300" : "border-line"} ${a.status === "dismissed" ? "opacity-60" : ""}`}>
      <span className="w-1.5 shrink-0" style={{ background: TONE_BAR[tone] }} aria-hidden="true" />
      <Link href={`/alerts/${a.id}`} className="grid min-w-0 flex-1 gap-4 p-5 text-inherit sm:grid-cols-[7.5rem_1fr_auto] sm:items-center">
        <div>
          <p className="font-display text-3xl font-black leading-none tabular-nums" style={{ color }}>
            {pct === null ? "–" : a.alert_type ? ruleValue(a.alert_type, pct) : signedPct(pct)}
          </p>
          <p className="mt-1 text-xs text-muted">{a.detail?.metric ?? "vs last year"}</p>
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {unread && <span className="h-2 w-2 rounded-full bg-accent" aria-label="New" />}
            <span className="font-display text-sm font-extrabold uppercase tracking-[0.04em]">{plain.title}</span>
            <span className="text-sm font-semibold text-slate-600">{a.scope_label ?? fmtDate(a.date)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-700">{a.headline ?? plain.meaning}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {sev && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="h-2 w-2" style={{ background: TONE_BAR[tone] }} aria-hidden="true" />
                {sev.label}
              </span>
            )}
            {act && <span className={`font-bold ${act.late ? "text-slate-700" : "text-accent"}`}>{act.text}</span>}
            {rule && <span className="font-semibold text-slate-700">Your rule</span>}
            <span>Raised {relTime(a.created_at, now)}</span>
            {a.status === "dismissed" && <span>Dismissed</span>}
          </p>
        </div>
        <span className="hidden items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.08em] text-slate-900 transition-colors group-hover:text-accent sm:inline-flex">
          {rule ? "What to do" : "View reasons"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
      {a.status !== "dismissed" && (
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:static sm:m-3 sm:self-center"
          onClick={() => onDismiss(a)}
          aria-label={`Dismiss alert for ${a.scope_label ?? a.date}`}
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
