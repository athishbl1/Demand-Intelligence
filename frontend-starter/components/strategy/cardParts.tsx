"use client";

import type { ReactNode } from "react";
import { Megaphone, Rocket, Users } from "lucide-react";
import { fmtDate } from "@/lib/dashboard";
import { useT } from "@/lib/i18n";
import { MARKET_PLAIN, type Level, type Strategy } from "@/lib/strategy";
import { CONFIDENCE_PLAIN } from "@/components/agent/plain";

/**
 * Every plan card (the three suggestions and "your idea") is a subgrid of ROWS rows, so Who, When, How,
 * the rating and the buttons line up across all cards, whatever the text length. The parent grid in
 * StrategyView holds the shared row tracks.
 */
export const ROWS = 9;
export const CARD_GRID = "row-span-9 grid grid-rows-subgrid"; // keep in step with ROWS

export interface Tone {
  label: string;
  bg: string;
  fg: string;
}

/** Colour by rank of the score, best first, using only the app palette: green (good), amber (chart "last year"), grey. The user's own idea gets the brand crimson. */
const RANK_TONES: Tone[] = [
  { label: "Our top pick", bg: "var(--delta-good)", fg: "#ffffff" },
  { label: "Strong option", bg: "var(--viz-py)", fg: "#1a1a1a" },
  { label: "Worth testing", bg: "var(--text-muted)", fg: "#ffffff" },
];
export const rankTone = (idx: number): Tone => RANK_TONES[idx] ?? { label: "Option", bg: "var(--text-muted)", fg: "#ffffff" };
export const CUSTOM_TONE: Tone = { label: "Your idea", bg: "var(--accent)", fg: "#ffffff" };

export const EFFORT_PLAIN: Record<Level, string> = { low: "Easy to run", medium: "Some effort", high: "Big effort" };

const day = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

export function ToneBadge({ tone }: { tone: Tone }) {
  const t = useT();
  return (
    <span
      className="inline-flex items-center border-[1.5px] px-2 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-[0.08em]"
      style={{ background: "#ffffff", color: "var(--accent)", borderColor: "var(--accent)" }}
    >
      {t(tone.label)}
    </span>
  );
}

/** One row of a card, with the same left padding everywhere. */
export function Cell({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <div className={`px-5 pt-4 sm:px-6 ${className}`}>{children}</div>;
}

function Labeled({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-slate-100 text-slate-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
        <div className="mt-0.5 leading-snug">{children}</div>
      </div>
    </div>
  );
}

/** Who / When / How as three grid rows (rendered as fragments so each lands in its own subgrid row). */
export function WhoWhenHow({ s, today }: { s: Pick<Strategy, "audience" | "markets" | "timing" | "hook"> & { channels?: string[] }; today: string }) {
  const t = useT();
  const late = s.timing.late;
  const daysToLaunch = Math.round((day(s.timing.launch_by) - day(today)) / 86_400_000);
  return (
    <>
      <Cell className="text-[15px]">
        <Labeled icon={<Users className="h-4 w-4" aria-hidden="true" />} label={t("Who")}>
          <span>{s.audience || "—"}</span>
          {s.markets.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {s.markets.map((m) => (
                <span key={m} className="inline-block bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                  {t(MARKET_PLAIN[m] ?? m)}
                </span>
              ))}
            </span>
          )}
        </Labeled>
      </Cell>
      <Cell className="text-[15px]">
        <Labeled icon={<Rocket className="h-4 w-4" aria-hidden="true" />} label={t("When")}>
          <span className="font-semibold">{late ? t("Start now") : t("Start by {d}", { d: fmtDate(s.timing.launch_by, false) })}</span>{" "}
          <span className="text-muted">· {late ? t("The ideal date has passed") : t("in {n} days", { n: daysToLaunch })}</span>
          <span className="block text-sm text-muted">{t("For guests arriving {a} – {b}", { a: fmtDate(s.timing.from, false), b: fmtDate(s.timing.to) })}</span>
        </Labeled>
      </Cell>
      <Cell className="text-[15px]">
        {s.hook ? (
          <Labeled icon={<Megaphone className="h-4 w-4" aria-hidden="true" />} label={t("How")}>
            <span>{s.hook}</span>
          </Labeled>
        ) : null}
      </Cell>
    </>
  );
}

/** Effort, confidence and priority in three fixed columns, for suggested and own plans alike. */
export function RatingRow({ effort, confidence, priority }: { effort?: Level; confidence?: Strategy["confidence"]; priority?: number }) {
  const t = useT();
  const conf = confidence ? CONFIDENCE_PLAIN[confidence] : null;
  const item = (label: string, value: string) => (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold leading-tight text-slate-900">{value}</p>
    </div>
  );
  return (
    <Cell>
      <div className="grid grid-cols-3 gap-2 border-t border-line pt-4">
        {item(t("Effort"), effort ? t(EFFORT_PLAIN[effort]) : "–")}
        {item(t("Confidence"), conf ? t(conf.label.replace(" confidence", "")) : "–")}
        {item(t("Priority"), priority !== undefined ? `${priority}/100` : "–")}
      </div>
    </Cell>
  );
}
