"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Rocket, TrendingUp } from "lucide-react";
import type { ChangeType } from "@/lib/agent";
import { findSetForExplanation, strategize, type StrategySet } from "@/lib/strategy";

const RECOVER: ChangeType[] = ["real_drop", "expected_drop", "forecast_drop", "forecast_too_high"];

/**
 * The hand-over from "why" to "what to do": a band under the reasons. Opens the existing plan of this explanation
 * or asks the strategist for a new one. A secondary button, so the explain page keeps one crimson CTA.
 */
export function SuggestStrategies({ explanationId, changeType }: { explanationId: number; changeType: ChangeType }) {
  const t = useT();
  const router = useRouter();
  const [existing, setExisting] = useState<StrategySet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rise = !RECOVER.includes(changeType);

  useEffect(() => {
    const c = new AbortController();
    findSetForExplanation(explanationId, c.signal).then(setExisting).catch(() => setExisting(null));
    return () => c.abort();
  }, [explanationId]);

  const go = async () => {
    if (existing) return router.push(`/strategies/${existing.set_id}`);
    setBusy(true);
    setError(null);
    try {
      const s = await strategize(explanationId);
      router.push(`/strategies/${s.set_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-5 border border-line bg-white p-5 sm:p-7 md:grid-cols-[auto_1fr_auto] md:items-center" aria-labelledby="next-title">
      <span className="flex h-12 w-12 items-center justify-center bg-slate-900 text-white" aria-hidden="true">
        {rise ? <TrendingUp className="h-6 w-6" /> : <Rocket className="h-6 w-6" />}
      </span>
      <div className="min-w-0">
        <span className="eyebrow">{t("Next step")}</span>
        <h2 id="next-title" className="mt-2 text-xl !normal-case">{rise ? t("Make the most of the extra demand") : t("What can we do about it?")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {rise
            ? t("The campaign strategist suggests up to three ways to protect value, spread demand to weaker weeks and keep the guests.")
            : t("The campaign strategist turns these reasons into up to three campaign strategies for the next window that can still be won, with a launch date.")}
          {existing && ` ${t("A plan already exists (version {v}{c}).", { v: existing.version, c: existing.status === "accepted" ? t(", strategy chosen") : "" })}`}
        </p>
        {error && <p className="notice-error mt-3 text-sm">{error}</p>}
      </div>
      <button type="button" className="btn-secondary" onClick={go} disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        {busy ? t("Thinking about strategies …") : existing ? t("Open the campaign plan") : t("Suggest strategies")}
      </button>
    </section>
  );
}
