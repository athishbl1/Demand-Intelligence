"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  explain,
  getExplanation,
  loadDemoExplanation,
  regenerate as regenerateCall,
  type ExplainQuery,
  type Explanation,
  type FeedbackItem,
} from "@/lib/agent";
import { explainDemo, type DemoRecord } from "@/lib/demo";

export interface ExplanationState {
  data: Explanation | null;
  loading: boolean;
  /** "regenerate" while a reanalysis runs, "load" otherwise. */
  busy: "load" | "regenerate" | null;
  error: string | null;
  demo: boolean;
  ask: (q: ExplainQuery, force?: boolean) => void;
  open: (id: number) => void;
  /** Explains the day of the n8n demo feed (the dummy actual stays out of the database). */
  askDemo: (r: DemoRecord) => void;
  reanalyse: (feedback: FeedbackItem[], note: string) => Promise<boolean>;
}

/** Loads an explanation (by question or by id), switches versions and runs a reanalysis. Aborts on unmount. */
export function useExplanation(): ExplanationState {
  const [data, setData] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState<"load" | "regenerate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback((kind: "load" | "regenerate", fn: (s: AbortSignal) => Promise<Explanation>, fallback = false) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(kind);
    setError(null);
    return fn(c.signal)
      .then((r) => {
        if (c.signal.aborted) return false;
        setData(r);
        setDemo(false);
        return true;
      })
      .catch(async (e: unknown) => {
        if (c.signal.aborted) return false;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (fallback) {
          try {
            setData(await loadDemoExplanation());
            setDemo(true);
          } catch {
            /* no snapshot: the error notice is enough */
          }
        }
        return false;
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(null);
      });
  }, []);

  const ask = useCallback((q: ExplainQuery, force = false) => void run("load", (s) => explain(q, { force, signal: s }), true), [run]);
  const askDemo = useCallback((r: DemoRecord) => void run("load", (s) => explainDemo(r, s)), [run]);
  const open = useCallback((id: number) => void run("load", (s) => getExplanation(id, s)), [run]);
  const reanalyse = useCallback(
    (feedback: FeedbackItem[], note: string) => {
      if (!data) return Promise.resolve(false);
      return run("regenerate", (s) => regenerateCall(data.explanation_id, feedback, note, s));
    },
    [data, run],
  );

  return { data, loading: busy === "load", busy, error, demo, ask, open, askDemo, reanalyse };
}
