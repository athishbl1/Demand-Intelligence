"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkCustom,
  decide as decideCall,
  getSet,
  regenerateSet,
  type StrategyFeedback,
  type StrategySet,
} from "@/lib/strategy";

export type StrategyBusy = "load" | "regenerate" | "custom" | "decide" | null;

/** Loads one strategy set and runs reanalyse, the custom check and the decision. Aborts on unmount. */
export function useStrategySet(initialId: number | null) {
  const [data, setData] = useState<StrategySet | null>(null);
  const [busy, setBusy] = useState<StrategyBusy>(initialId ? "load" : null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(async (kind: Exclude<StrategyBusy, null>, fn: (s: AbortSignal) => Promise<StrategySet>) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(kind);
    setError(null);
    try {
      const r = await fn(c.signal);
      if (c.signal.aborted) return false;
      setData(r);
      return true;
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      if (!c.signal.aborted) setBusy(null);
    }
  }, []);

  const open = useCallback((id: number) => run("load", (s) => getSet(id, s)), [run]);

  useEffect(() => {
    if (initialId) void open(initialId);
    return () => ctrl.current?.abort();
  }, [initialId, open]);

  const reanalyse = useCallback(
    (feedback: StrategyFeedback[], note: string) => (data ? run("regenerate", (s) => regenerateSet(data.set_id, feedback, note, s)) : Promise.resolve(false)),
    [data, run],
  );
  const custom = useCallback((text: string) => (data ? run("custom", (s) => checkCustom(data.set_id, text, s)) : Promise.resolve(false)), [data, run]);

  const decide = useCallback(
    async (choice: number | "dismiss" | "reopen") => {
      if (!data) return false;
      setBusy("decide");
      setError(null);
      try {
        const r = await decideCall(data.set_id, choice);
        setData({ ...data, status: r.status, accepted_idx: r.accepted_idx, decided_at: r.decided_at });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [data],
  );

  return { data, busy, error, open, reanalyse, custom, decide };
}
