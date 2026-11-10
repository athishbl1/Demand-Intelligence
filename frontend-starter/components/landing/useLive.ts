"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDashboard } from "@/lib/useDashboard";

/**
 * Real-time helpers for the landing page:
 * - useLiveDashboard: the n8n overview, re-fetched every minute while the tab is visible
 * - useNow: a ticking clock (null until mounted, so server and client markup match)
 * - useIschglWeather: current conditions in the valley and on the mountain (Open-Meteo, no key)
 */

export function useLiveDashboard(intervalMs = 60_000, enabled = true) {
  const state = useDashboard();
  const { data, refresh } = state;
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (data) setUpdatedAt(Date.now());
  }, [data]);

  // Next refresh is due `intervalMs` after the last update (also after a manual refresh).
  // A hidden tab is not polled; it catches up as soon as it becomes visible again.
  useEffect(() => {
    if (!enabled || updatedAt === null) return;
    const due = () => Date.now() - updatedAt >= intervalMs;
    const id = setTimeout(() => {
      if (document.visibilityState === "visible") refresh();
    }, Math.max(0, updatedAt + intervalMs - Date.now()));
    const onVisible = () => {
      if (document.visibilityState === "visible" && due()) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs, enabled, updatedAt]);

  return { ...state, updatedAt };
}

export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "just now", "42 s ago", "3 min ago" */
export function ago(now: number | null, t: number | null): string {
  if (now === null || t === null) return "…";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return tr("just now");
  if (s < 60) return tr("{n} s ago", { n: s });
  return tr("{n} min ago", { n: Math.floor(s / 60) });
}

/* ------------------------------------------------------------------ weather */

export interface WeatherPoint {
  label: string;
  elevation: number;
  temp: number | null;
  feels: number | null;
  code: number | null;
  wind: number | null;
  snowfall: number | null;
  snowDepth: number | null;
  isDay: boolean;
}

export interface WeatherDay {
  date: string;
  snow: number;
  tmax: number;
  tmin: number;
  code: number;
}

export interface IschglWeather {
  points: WeatherPoint[];
  days: WeatherDay[];
  fetchedAt: number;
}

const SPOTS = [
  { label: "Ischgl village", lat: 47.0123, lon: 10.2913, elevation: 1377 },
  { label: "Idalp mountain", lat: 46.9894, lon: 10.3163, elevation: 2320 },
];

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?" +
  new URLSearchParams({
    latitude: SPOTS.map((s) => s.lat).join(","),
    longitude: SPOTS.map((s) => s.lon).join(","),
    elevation: SPOTS.map((s) => s.elevation).join(","),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,snowfall,snow_depth,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum",
    timezone: "Europe/Vienna",
    forecast_days: "7",
  }).toString();

type OmCurrent = Partial<Record<string, number>>;
type OmDaily = { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; snowfall_sum: number[] };
type OmResult = { current?: OmCurrent; daily?: OmDaily };

export function useIschglWeather(intervalMs = 10 * 60_000) {
  const [weather, setWeather] = useState<IschglWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(WEATHER_URL);
        if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
        const json = (await res.json()) as OmResult | OmResult[];
        const list = Array.isArray(json) ? json : [json];
        const points = list.map((r, i): WeatherPoint => {
          const c = r.current ?? {};
          return {
            label: SPOTS[i]?.label ?? `Spot ${i + 1}`,
            elevation: SPOTS[i]?.elevation ?? 0,
            temp: c.temperature_2m ?? null,
            feels: c.apparent_temperature ?? null,
            code: c.weather_code ?? null,
            wind: c.wind_speed_10m ?? null,
            snowfall: c.snowfall ?? null,
            snowDepth: c.snow_depth ?? null,
            isDay: c.is_day !== 0,
          };
        });
        // Daily outlook from the mountain spot: that is where the snow matters.
        const d = (list[1] ?? list[0])?.daily;
        const days: WeatherDay[] = d
          ? d.time.map((date, i) => ({
              date,
              snow: d.snowfall_sum[i] ?? 0,
              tmax: d.temperature_2m_max[i],
              tmin: d.temperature_2m_min[i],
              code: d.weather_code[i],
            }))
          : [];
        if (alive) {
          setWeather({ points, days, fetchedAt: Date.now() });
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { weather, error };
}

/** WMO weather code -> short label. */
export function weatherLabel(code: number | null): string {
  if (code === null) return "–";
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}
