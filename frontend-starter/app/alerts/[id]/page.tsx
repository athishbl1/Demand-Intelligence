"use client";

import { friendlyError } from "@/lib/errors";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, X } from "lucide-react";
import { listAlerts, ruleInfo, setAlertStatus, type Alert } from "@/lib/agent";
import { actByText, ruleValue } from "@/components/agent/AlertRules";
import { fmtDate } from "@/lib/dashboard";
import { currentDemoRecord, getDemoAlert } from "@/lib/demo";
import { useExplanation } from "@/lib/useExplanation";
import { ExplanationView } from "@/components/agent/ExplanationView";
import { SeverityPill } from "@/components/agent/ChangeSummary";
import { CHANGE_PLAIN, relTime } from "@/components/agent/plain";

/** One alert: marks it read and shows the agent's explanation (same view as /explain). */
export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const x = useExplanation();
  const { open, ask, askDemo } = x;
  const [alert, setAlert] = useState<Alert | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      setError("This alert does not exist.");
      return;
    }
    let off = false;
    if (id < 0) {
      // demo alert from the n8n demo feed: lives in this browser only
      const a = getDemoAlert();
      const r = currentDemoRecord();
      if (!a || a.id !== id || !r) {
        setError("This demo alert has expired. Send a new one from the Alerts page.");
        return;
      }
      setAlert(a);
      askDemo(r);
      if (a.status === "unread") void setAlertStatus(a.id, "read");
      return;
    }
    (async () => {
      try {
        const open1 = await listAlerts("open");
        let a = open1.alerts.find((y) => y.id === id) ?? null;
        if (!a) a = (await listAlerts("dismissed")).alerts.find((y) => y.id === id) ?? null;
        if (off) return;
        if (!a) return setError("This alert does not exist (any more).");
        setAlert(a);
        if (a.explanation_id) open(a.explanation_id);
        else if (a.detail?.from && a.detail?.to && a.alert_type !== "slow_bookings" && a.alert_type !== "data_gap") {
          // a rule alert on coming weeks: ask the agent what lies behind the weak forecast (cached per period in n8n).
          // The agent accepts at most 92 days, so the whole-season rule shows its numbers only.
          const days = (Date.parse(a.detail.to) - Date.parse(a.detail.from)) / 86_400_000;
          if (days <= 91) ask({ scope: "range", from: a.detail.from, to: a.detail.to, compare: "py" });
        }
        if (a.status === "unread") await setAlertStatus(a.id, "read");
      } catch (e) {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      off = true;
    };
  }, [id, open, ask, askDemo]);

  const dismiss = async () => {
    if (!alert) return;
    await setAlertStatus(alert.id, "dismissed");
    setAlert({ ...alert, status: "dismissed" });
  };

  const isDemo = !!alert && alert.id < 0;
  const rule = ruleInfo(alert?.alert_type);
  const act = actByText(alert?.detail?.act_by);
  const plain = alert ? (rule ? { title: rule.label } : CHANGE_PLAIN[alert.change_type]) : null;

  return (
    <div className="container-page flex flex-col gap-6 py-10 sm:py-14">
      <nav className="flex items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/alerts" className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-accent">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Alerts
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate">{alert?.scope_label ?? "Alert"}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="eyebrow">{isDemo ? "Agent alert · demo feed" : "Agent alert"}</span>
          <h1 className="page-title mt-3">{plain ? plain.title : "Alert"}</h1>
          {alert && (
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <SeverityPill severity={alert.severity} />
              <span>
                Period: <b className="text-slate-900">{alert.scope_label ?? alert.date}</b>
              </span>
              <span>Raised {relTime(alert.created_at)}</span>
              {alert.status === "dismissed" && <span className="font-semibold">Dismissed</span>}
            </p>
          )}
        </div>
        {alert && alert.status !== "dismissed" ? (
          <button type="button" className="btn-secondary" onClick={dismiss}>
            <X className="h-4 w-4" aria-hidden="true" />
            Dismiss alert
          </button>
        ) : alert ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
            <Check className="h-4 w-4" aria-hidden="true" />
            Dismissed
          </span>
        ) : null}
      </header>

      {alert && isDemo && alert.detail && (
        <section className="grid gap-px border border-line bg-[var(--line)] sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]" aria-label="Demo feed numbers">
          <div className="bg-white p-5">
            <p className="kpi-label">Demo feed (n8n)</p>
            <p className="mt-2 font-display text-lg font-extrabold">{alert.headline}</p>
            <p className="mt-2 text-xs text-muted">
              Test data pushed by the n8n workflow &quot;team-07 · Demo&quot;. It is kept in this browser only and never written to the database. Open the reasons below, then plan a campaign.
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="kpi-label">Change vs forecast</p>
            <p className="mt-1 font-display text-3xl font-black tabular-nums" style={{ color: (alert.delta_pct ?? 0) < 0 ? "var(--delta-bad)" : "var(--delta-good)" }}>
              {alert.delta_pct === null ? "–" : `${alert.delta_pct > 0 ? "+" : ""}${alert.delta_pct} %`}
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="kpi-label">Reported (demo)</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums">{alert.detail.actual?.toLocaleString("en-GB") ?? "–"}</p>
          </div>
          <div className="bg-white p-5">
            <p className="kpi-label">Forecast</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums">{alert.detail.forecast?.toLocaleString("en-GB") ?? "–"}</p>
            <p className="mt-1 text-xs text-muted">Alert from ±{alert.detail.threshold} %</p>
          </div>
        </section>
      )}

      {alert && rule && alert.detail && (
        <section className="grid gap-px border border-line bg-[var(--line)] sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]" aria-label="Why this rule fired">
          <div className="bg-white p-5">
            <p className="kpi-label">What to do</p>
            <p className="mt-2 font-display text-lg font-extrabold">{rule.action}</p>
            {act && (
              <p className={`mt-1 text-sm font-bold ${act.late ? "text-slate-700" : "text-accent"}`}>
                {act.text}
                {alert.detail.lead_days !== undefined && !act.late && <span className="font-normal text-slate-600"> · half of the guests book {alert.detail.lead_days} days or more ahead</span>}
              </p>
            )}
            {alert.detail.markets && alert.detail.markets.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                School holidays in
                {alert.detail.markets.map((m) => (
                  <span key={m} className="badge-gray">{m}</span>
                ))}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-700">{alert.headline}</p>
            <p className="mt-2 text-xs text-muted">
              Checked by n8n for {fmtDate(alert.detail.from)} to {fmtDate(alert.detail.to)}. Change the rule on the Alerts page.
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="kpi-label">{alert.detail.metric}</p>
            <p className="mt-1 font-display text-3xl font-black tabular-nums" style={{ color: "var(--delta-bad)" }}>
              {ruleValue(alert.alert_type!, alert.delta_pct === null ? null : Number(alert.delta_pct))}
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="kpi-label">{alert.alert_type === "slow_bookings" ? "Bookings" : "Forecast stays"}</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums">
              {(alert.detail.bookings ?? alert.detail.forecast ?? alert.detail.actual)?.toLocaleString("en-GB") ?? "–"}
            </p>
          </div>
          <div className="bg-white p-5">
            <p className="kpi-label">Alert threshold</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums">
              {alert.detail.threshold} {rule.unit}
            </p>
            {alert.detail.reference !== undefined && (
              <p className="mt-1 text-xs text-muted">
                Last {alert.alert_type === "slow_bookings" ? "4-week average" : "year"}: {Number(alert.detail.reference).toLocaleString("en-GB")}
              </p>
            )}
            {alert.detail.reachable_pct !== undefined && (
              <p className="mt-1 text-xs text-muted">About {alert.detail.reachable_pct} % of bookings for this week usually still come in.</p>
            )}
          </div>
        </section>
      )}

      {(error || x.error) && (
        <div className="notice-error text-sm" role="alert">
          {friendlyError(error ?? x.error)}
        </div>
      )}
      {x.loading && !x.data && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="skeleton h-72" />
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-56" />
            ))}
          </div>
        </div>
      )}
      {x.data && <ExplanationView e={x.data} busy={x.busy} onOpen={x.open} onReanalyse={x.reanalyse} hideSeverity />}
    </div>
  );
}
