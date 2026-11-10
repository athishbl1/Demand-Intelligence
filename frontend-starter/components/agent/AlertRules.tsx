"use client";

import { useCallback, useEffect, useState } from "react";
import { BellPlus, RefreshCw, Trash2 } from "lucide-react";
import { friendlyError } from "@/lib/errors";
import {
  RULE_TYPES,
  RULE_TYPE_IDS,
  checkRules,
  deleteRule,
  listRules,
  saveRule,
  type AlertRule,
  type RuleType,
  type RulesState,
} from "@/lib/agent";
import { relTime, signedPct } from "./plain";
import { fmtDate } from "@/lib/dashboard";

/** "33.5 %" for occupancy, "5 days" for gaps, "−55.0 %" for the comparisons. */
export function ruleValue(type: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  if (type === "data_gap") return `${value} day${value === 1 ? "" : "s"}`;
  if (type === "low_occupancy") return `${Number(value).toFixed(1)} %`;
  return signedPct(Number(value));
}

/** "Act by 13 Nov" / "Booking window passed" for coming-week alerts. */
export function actByText(actBy: string | null | undefined, today = new Date().toISOString().slice(0, 10)): { text: string; late: boolean } | null {
  if (!actBy) return null;
  const late = actBy < today;
  return { text: late ? "Main booking window passed" : `Act by ${fmtDate(actBy)}`, late };
}

const whenText = (type: RuleType, t: number) => (RULE_TYPES[type]?.when ?? "").replace("{t}", String(t));

/**
 * The director's alert subscriptions: pick an alert type from the dropdown, set the threshold, add.
 * n8n ("team-07 · Drop Watch & Investigate") checks the enabled rules every hour and after each change,
 * and raises alerts into the inbox below.
 */
export function AlertRules() {
  const [state, setState] = useState<RulesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [type, setType] = useState<RuleType>("forecast_below_py");
  const [threshold, setThreshold] = useState<number>(RULE_TYPES.forecast_below_py.defaultThreshold);

  useEffect(() => {
    const c = new AbortController();
    listRules(c.signal)
      .then((r) => {
        setState(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted) setError(friendlyError(e instanceof Error ? e.message : String(e)));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, []);

  const act = useCallback(async (key: string, fn: () => Promise<RulesState>, done?: (r: RulesState) => string | null) => {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const r = await fn();
      setState(r);
      const n = done ? done(r) : null;
      setNote(n ?? (r.new_alerts > 0 ? `${r.new_alerts} new alert${r.new_alerts === 1 ? "" : "s"} in your inbox.` : null));
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }, []);

  const info = RULE_TYPES[type];
  const validNew = Number.isFinite(threshold) && threshold > 0 && threshold <= info.max;
  // only types this app knows: a rule of an older or newer type must never break the page
  const rules = (state?.rules ?? []).filter((r) => r.type in RULE_TYPES);

  return (
    <section aria-labelledby="rules-title" className="border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="rules-title" className="font-display text-sm font-extrabold uppercase tracking-[0.12em]">
            My alert rules
          </h2>
          <p className="mt-1 text-xs text-muted">
            Every rule looks ahead from today into the coming season, so each alert comes with something to do and an act-by date.
            n8n checks every hour and right after each change.
            {state?.checked_at && <> Last check {relTime(state.checked_at)}.</>}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => act("check", checkRules, (r) => (r.new_alerts ? null : "Checked. No new alerts."))} disabled={!!busy || loading}>
          {busy === "check" ? <span className="spinner" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Check rules now
        </button>
      </div>

      {/* add a rule: the dropdown */}
      <form
        className="grid gap-3 border-b border-line bg-slate-50 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validNew) return;
          void act("add", () => saveRule({ type, threshold }), (r) => {
            const added = r.rules[r.rules.length - 1];
            return r.new_alerts
              ? `Rule added. It found ${r.new_alerts} new alert${r.new_alerts === 1 ? "" : "s"}.`
              : added
                ? "Rule added. Nothing to report right now."
                : null;
          });
        }}
      >
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="label">Alert me when</span>
          <select
            className="field"
            value={type}
            onChange={(e) => {
              const t = e.target.value as RuleType;
              setType(t);
              setThreshold(RULE_TYPES[t].defaultThreshold);
            }}
          >
            {RULE_TYPE_IDS.map((id) => (
              <option key={id} value={id}>
                {RULE_TYPES[id].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Threshold ({info.unit})</span>
          <input
            className="field tabular-nums"
            type="number"
            min={info.unit === "days" ? 1 : 0.5}
            max={info.max}
            step={info.unit === "days" ? 1 : 0.5}
            value={Number.isFinite(threshold) ? threshold : ""}
            onChange={(e) => setThreshold(e.target.value === "" ? NaN : Number(e.target.value))}
            required
          />
        </label>
        <button type="submit" className="btn" disabled={!validNew || !!busy || loading}>
          {busy === "add" ? <span className="spinner" aria-hidden="true" /> : <BellPlus className="h-4 w-4" aria-hidden="true" />}
          Add rule
        </button>
        <p className="text-xs text-slate-600 sm:col-span-3">
          {validNew ? (
            <>
              {whenText(type, threshold)} <b className="text-slate-900">Then: {info.action}</b>
            </>
          ) : (
            `Enter a threshold between 0 and ${info.max}.`
          )}
        </p>
      </form>

      {(error || note) && (
        <div className="px-5 pt-4">
          <div className={error ? "notice-error text-sm" : "notice text-sm"} role={error ? "alert" : "status"}>
            {error ?? note}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <p className="p-5 text-sm text-slate-600">No rules yet. Pick an alert type above to start.</p>
      ) : (
        <ul className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {rules.map((r) => (
            <RuleCard
              key={r.id}
              r={r}
              busy={busy}
              onToggle={() => act(`t${r.id}`, () => saveRule({ rule_id: r.id, enabled: !r.enabled }))}
              onThreshold={(t) => act(`s${r.id}`, () => saveRule({ rule_id: r.id, threshold: t }))}
              onDelete={() => act(`d${r.id}`, () => deleteRule(r.id), () => "Rule removed. Its earlier alerts stay in the inbox.")}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RuleCard({
  r,
  busy,
  onToggle,
  onThreshold,
  onDelete,
}: {
  r: AlertRule;
  busy: string | null;
  onToggle: () => void;
  onThreshold: (t: number) => void;
  onDelete: () => void;
}) {
  const info = RULE_TYPES[r.type];
  const [t, setT] = useState<number>(Number(r.threshold));
  useEffect(() => setT(Number(r.threshold)), [r.threshold]);
  const periods = r.last_result?.periods ?? [];
  const hits = r.last_result?.hits ?? 0;
  // the period that matters most: a firing one first, otherwise the latest
  // the period that needs action first: the earliest firing one, otherwise the weakest
  const show = periods.filter((p) => p.fire).sort((a, b) => a.date.localeCompare(b.date))[0] ?? [...periods].sort((a, b) => a.value - b.value)[0];
  const act = show?.fire ? actByText(show.act_by) : null;
  const changed = t !== Number(r.threshold) && Number.isFinite(t) && t > 0 && t <= info.max;
  const off = !r.enabled;

  return (
    <li className={`flex flex-col gap-3 border p-4 ${off ? "border-dashed border-slate-300 bg-slate-50" : hits ? "border-slate-300" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.04em]">{r.label || info.label}</p>
          <p className="mt-1 text-xs text-slate-600">{whenText(r.type, Number(r.threshold))}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={r.enabled} onChange={onToggle} disabled={!!busy} />
          {r.enabled ? "On" : "Off"}
        </label>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {off ? (
            <p className="text-xs text-muted">Paused. n8n skips this rule.</p>
          ) : show ? (
            <>
              <p className="font-display text-2xl font-black tabular-nums" style={{ color: show.fire ? "var(--delta-bad)" : undefined }}>
                {ruleValue(r.type, show.value)}
              </p>
              <p className="text-xs text-muted">{show.label}</p>
              {act && <p className={`mt-1 text-xs font-bold ${act.late ? "text-slate-600" : "text-accent"}`}>{act.text}</p>}
            </>
          ) : (
            <p className="text-xs text-muted">No data for this rule yet.</p>
          )}
        </div>
        {!off && (
          <span className={hits ? "badge-red" : "badge-green"}>{hits ? `${hits} to act on` : "All clear"}</span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Threshold
          <input
            className="field h-8 w-20 px-2 py-1 text-sm tabular-nums"
            type="number"
            min={info.unit === "days" ? 1 : 0.5}
            max={info.max}
            step={info.unit === "days" ? 1 : 0.5}
            value={Number.isFinite(t) ? t : ""}
            onChange={(e) => setT(e.target.value === "" ? NaN : Number(e.target.value))}
            aria-label={`Threshold for ${r.label || info.label}`}
          />
          {info.unit}
        </label>
        {changed && (
          <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => onThreshold(t)} disabled={!!busy}>
            {busy === `s${r.id}` ? <span className="spinner" aria-hidden="true" /> : "Save"}
          </button>
        )}
        <span className="ml-auto text-xs text-muted">{r.alerts_open} open</span>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
          onClick={onDelete}
          disabled={!!busy}
          aria-label={`Remove rule ${r.label || info.label}`}
          title="Remove rule"
        >
          {busy === `d${r.id}` ? <span className="spinner" aria-hidden="true" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}
