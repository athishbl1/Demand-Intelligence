"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALERTS_CHANGED, listAlerts, type Alert } from "@/lib/agent";
import { DEMO_CHANGED, getDemoAlert, syncDemoFeed } from "@/lib/demo";

const POLL_MS = 60_000;
const DEMO_POLL_MS = 10_000;

export interface AlertsState {
  alerts: Alert[];
  unread: number;
  asOf: string | null;
  loading: boolean;
  error: string | null;
  /** The newest unread alert that arrived since the last poll (for the toast). */
  latestNew: Alert | null;
  clearLatest: () => void;
  refresh: () => void;
}

/**
 * Polls the agent's alerts every 60 s and pauses while the tab is hidden.
 * The first load never raises a toast; later polls do for alerts not seen before.
 */
export function useAlerts(status: "open" | "unread" | "read" | "dismissed" = "open"): AlertsState {
  const [realAlerts, setAlerts] = useState<Alert[]>([]);
  const [realUnread, setUnread] = useState(0);
  const [demoAlert, setDemoAlert] = useState<Alert | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestNew, setLatestNew] = useState<Alert | null>(null);
  const seen = useRef<Set<number> | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    listAlerts(status, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setAlerts(r.alerts);
        setUnread(r.unread);
        setAsOf(typeof r.as_of_date === "string" ? r.as_of_date : null);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
  }, [status]);

  // the demo alert (browser only, fed by n8n "team-07 · Demo") joins the list of the matching tab
  useEffect(() => {
    const c = new AbortController();
    const pull = () => {
      syncDemoFeed(c.signal).then(() => setDemoAlert(getDemoAlert()));
    };
    const local = () => setDemoAlert(getDemoAlert());
    setDemoAlert(getDemoAlert());
    pull();
    const t = setInterval(() => {
      if (!document.hidden) pull();
    }, DEMO_POLL_MS);
    window.addEventListener(DEMO_CHANGED, local);
    return () => {
      c.abort();
      clearInterval(t);
      window.removeEventListener(DEMO_CHANGED, local);
    };
  }, []);

  const mine = demoAlert && (status === "dismissed" ? demoAlert.status === "dismissed" : demoAlert.status !== "dismissed") ? demoAlert : null;
  const alerts = useMemo(() => (mine ? [mine, ...realAlerts] : realAlerts), [mine, realAlerts]);
  const unread = realUnread + (mine && mine.status === "unread" ? 1 : 0);

  // toast for alerts that arrive after the first load
  useEffect(() => {
    if (loading) return;
    let fresh = seen.current ? alerts.find((a) => a.status === "unread" && !seen.current!.has(a.id)) : undefined;
    // a demo alert gets its toast once per browser tab, even when it was there before the first load
    const d = alerts.find((a) => a.id < 0 && a.status === "unread");
    if (!fresh && d) {
      try {
        const key = `team07.demo.toast.${d.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          fresh = d;
        }
      } catch {
        /* no sessionStorage: no toast */
      }
    }
    if (fresh) setLatestNew(fresh);
    seen.current = new Set(alerts.map((a) => a.id));
  }, [alerts, loading]);

  useEffect(() => {
    load();
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(load, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.hidden) stop();
      else {
        load();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(ALERTS_CHANGED, load);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(ALERTS_CHANGED, load);
      ctrl.current?.abort();
    };
  }, [load]);

  return { alerts, unread, asOf, loading, error, latestNew, clearLatest: () => setLatestNew(null), refresh: load };
}
