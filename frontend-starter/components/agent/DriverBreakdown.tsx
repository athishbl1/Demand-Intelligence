"use client";

import { Activity, CheckCircle2, Eye, Gauge, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatNumber } from "@/lib/app";
import { tr, useT } from "@/lib/i18n";
import { signedPct } from "./plain";
import type { DriverBreakdown as DB, Observation, RuledOut, VsLastYear } from "@/lib/agent";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(Math.round(n)))}`;

const OBS_ICON: Record<Observation["kind"], typeof Eye> = { noise: Gauge, what_we_see: Eye, where: MapPin, context: Activity, data: TriangleAlert };
const OBS_LABEL: Record<Observation["kind"], string> = {
  noise: "Forecast noise",
  what_we_see: "What we see",
  where: "Where it happened",
  context: "Context",
  data: "Data check",
};

/**
 * "How the change adds up": the change against the same weekdays last year as a waterfall of driver effects
 * (with their 90 % range), the weekday shift, and what is left unexplained. Below: observations that describe the change
 * (bookings, free beds, which days) but are not counted as reasons, and the drivers that were checked and had no effect.
 * All numbers come from the driver model in n8n, none from the AI.
 */
export function DriverBreakdown({
  d,
  vsPy,
  vsLastYear,
  observations = [],
  ruledOut = [],
}: {
  d: DB;
  /** Actual vs last year as one main point (logic "drivers-v5" on). Without it, the full driver waterfall is shown. */
  vsPy?: VsLastYear | null;
  vsLastYear?: { pct: number | null; label: string };
  observations?: Observation[];
  ruledOut?: RuledOut[];
}) {
  const t = useT();
  const shown = d.groups.filter((g) => g.significant);
  const shift = d.weekday_shift ?? 0;
  const hasShift = Math.abs(shift) >= Math.max(d.threshold, 1) && d.calendar_gap !== undefined;
  const total = vsPy ? vsPy.gap : d.calendar_gap ?? d.gap;
  const unexplained = total - shift - d.explained;
  type Row = { key: string; label: string; stays: number; ci: [number, number] | null; sub: DB["groups"][number]["sub"] };
  const mainGroup = vsPy?.main_point ? d.groups.find((g) => g.group === vsPy.main_point!.group) : undefined;
  const rows: Row[] = vsPy
    ? [
        // actual vs last year: the ONE main point, then everything else the model measured, then the rest
        ...(vsPy.main_point
          ? [{ key: "main", label: tr(vsPy.main_point.label), stays: vsPy.main_point.stays, ci: vsPy.main_point.ci, sub: mainGroup?.sub ?? [] }]
          : []),
        ...(Math.abs(vsPy.other_measured) >= Math.max(d.threshold, 1)
          ? [{ key: "other", label: t("Other measured causes together"), stays: vsPy.other_measured, ci: null, sub: [] }]
          : []),
        { key: "rest", label: t("Not explained by our data"), stays: vsPy.unexplained, ci: null, sub: [] },
      ]
    : [
        ...(hasShift ? [{ key: "shift", label: t("The weekday alone (last year’s date fell on a different day)"), stays: shift, ci: null, sub: [] }] : []),
        ...shown.map((g) => ({ key: g.group, label: tr(g.label), stays: g.stays, ci: g.ci, sub: g.sub })),
        { key: "rest", label: d.basis === "forecast" ? t("What the forecast assumes beyond the calendar") : t("Not explained by our data"), stays: unexplained, ci: null, sub: [] },
      ];
  const max = Math.max(1, Math.abs(total), ...rows.map((r) => Math.abs(r.stays)), ...rows.flatMap((r) => (r.ci ? r.ci.map((x) => Math.abs(x)) : [])));
  const pos = (v: number) => 50 + (v / max) * 50;

  return (
    <section className="border border-line bg-white" aria-labelledby="drivers-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <div>
          <span className="eyebrow">{vsPy ? t("Against last year") : t("How the change adds up")}</span>
          <h2 id="drivers-title" className="mt-3 text-xl !normal-case sm:text-2xl">
            {d.basis === "forecast" ? t("{n} stays expected against last year", { n: signed(total) }) : t("{n} stays against last year", { n: signed(total) })}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {vsPy
              ? t("The main thing that changed against last year, measured by our model. The thin line shows the likely range.")
              : t("Split into the causes we can measure. Bars show how many stays each cause adds or removes; the thin line shows the likely range.")}
          </p>
          {vsPy?.note && (
            <p className="mt-3 max-w-[72ch] border-l-[3px] border-slate-900 pl-3 text-[15px] leading-relaxed text-slate-800">
              {vsPy.main_point && <b className="font-semibold">{vsPy.main_point.title}. </b>}
              {vsPy.note}
            </p>
          )}
        </div>
        {vsLastYear && vsLastYear.pct !== null && (
          <div className="flex flex-col items-end">
            <span
              className="font-display text-4xl font-black leading-none tabular-nums"
              style={{ color: Math.abs(vsLastYear.pct) < 0.5 ? "var(--text-muted)" : vsLastYear.pct < 0 ? "var(--delta-bad)" : "var(--delta-good)" }}
            >
              {signedPct(vsLastYear.pct)}
            </span>
            <span className="mt-1.5 text-sm text-muted">{vsLastYear.label}</span>
          </div>
        )}
        <div className="text-right text-xs text-muted">
          <p className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Driver model")} {d.version} · {d.coefficients}
          </p>
          <p className="mt-0.5">
            {t("Typical error in this month")}: {d.backtest_mape_month !== null ? `${d.backtest_mape_month} %` : "–"} · {t("overall")} {d.backtest_mape ?? "–"} %
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-[var(--line)] px-5 sm:px-7">
        {rows.map((r) => {
          const a = pos(Math.min(0, r.stays)), b = pos(Math.max(0, r.stays));
          const rest = r.key === "rest";
          return (
            <li key={r.key} className="grid gap-2 py-3 md:grid-cols-[16rem_1fr_7rem] md:items-center">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${rest ? "text-slate-500" : ""}`}>{r.label}</p>
                {r.sub.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted">{r.sub.slice(0, 4).map((s) => `${s.label} ${signed(s.stays)}`).join(" · ")}</p>
                )}
              </div>
              <div className="relative h-6" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                {r.ci && (
                  <span className="absolute top-1/2 h-px -translate-y-1/2 bg-slate-500" style={{ left: `${pos(r.ci[0])}%`, width: `${Math.max(0.5, pos(r.ci[1]) - pos(r.ci[0]))}%` }} />
                )}
                <span
                  className={`absolute top-1/2 h-3.5 -translate-y-1/2 ${rest ? "bg-[repeating-linear-gradient(45deg,#cfd2d6_0,#cfd2d6_3px,#fff_3px,#fff_6px)]" : r.stays < 0 ? "bg-accent" : "bg-slate-900"}`}
                  style={{ left: `${a}%`, width: `${Math.max(0.6, b - a)}%` }}
                />
              </div>
              <p className={`text-right font-display text-sm font-extrabold tabular-nums ${rest ? "text-slate-500" : ""}`}>
                {signed(r.stays)}
                {r.ci && <span className="block text-[11px] font-semibold text-muted">{signed(r.ci[0])} {t("to")} {signed(r.ci[1])}</span>}
              </p>
            </li>
          );
        })}
      </ul>

      {(observations.length > 0 || ruledOut.length > 0) && (
        <div className="grid gap-6 border-t border-line bg-slate-50 px-5 py-5 sm:px-7 lg:grid-cols-[1.4fr_1fr]">
          {observations.length > 0 && (
            <div>
              <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">{t("Also seen in the data · not counted as reasons")}</p>
              <ul className="mt-3 flex flex-col gap-3">
                {observations.map((o) => {
                  const Icon = OBS_ICON[o.kind] ?? Eye;
                  return (
                    <li key={o.finding_id} className="flex gap-3 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-semibold">{t(OBS_LABEL[o.kind])}: {o.title}.</span>{" "}
                        <span className="text-slate-600">{o.statement}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {ruledOut.length > 0 && (
            <div>
              <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">{t("Checked, no effect")}</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {ruledOut.map((r) => (
                  <li key={r.group} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{tr(r.label)}</span> <span className="text-slate-600">— {r.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
