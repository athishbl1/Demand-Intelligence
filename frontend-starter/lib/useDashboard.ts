"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboard, type DashboardData, type DataSource } from "@/lib/dashboard";

export interface DashboardState {
  loading: boolean;
  data: DashboardData | null;
  source: DataSource | null;
  /** Live call failed (demo snapshot shown), or nothing could be loaded at all. */
  error: string | null;
  refresh: () => void;
}

/** Loads the dashboard once on mount; `refresh()` asks n8n again. */
export function useDashboard(): DashboardState {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    fetchDashboard(c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setData(r.data);
        setSource(r.source);
        setError(r.error ?? null);
      })
      .catch((e: unknown) => {
        if (c.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [load]);

  return { loading, data, source, error, refresh: load };
}
