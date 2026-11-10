"use client";

import { useEffect, useState } from "react";
import { getLang, useT } from "@/lib/i18n";
import { useMounted } from "./hooks";

/** Winter season start in Ischgl: 26 Nov 2026, 08:30 CET. */
export const SEASON_START = new Date("2026-11-26T08:30:00+01:00");

function parts(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
    done: ms === 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Countdown to the season start. "boxes": crimson squares for the hero badge.
 * "inline": compact text for the dark live strip. Shows dashes until mounted (no hydration mismatch).
 */
export function Countdown({ target = SEASON_START, variant = "inline" }: { target?: Date; variant?: "boxes" | "inline" }) {
  const mounted = useMounted();
  const [p, setP] = useState(() => parts(target));

  useEffect(() => {
    setP(parts(target));
    const id = setInterval(() => setP(parts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const t = useT();
  const de = getLang() === "de";
  const v = (n: number) => (mounted ? pad(n) : "--");

  if (p.done && mounted) {
    return <span className="font-display font-extrabold uppercase">{t("The season is open")}</span>;
  }

  if (variant === "inline") {
    return (
      <span className="font-display tabular-nums font-bold tracking-wider" role="timer" aria-live="off">
        {mounted ? p.days : "--"}{de ? "T" : "D"} {v(p.hours)}{de ? "Std" : "H"} {v(p.minutes)}M <span className="text-white/60">{v(p.seconds)}S</span>
      </span>
    );
  }

  const units = [
    { label: t("Days"), value: mounted ? String(p.days) : "--" },
    { label: t("Hours"), value: v(p.hours) },
    { label: t("Min"), value: v(p.minutes) },
    { label: t("Sec"), value: v(p.seconds) },
  ];
  return (
    <div className="flex gap-1.5" role="timer" aria-live="off">
      {units.map((u) => (
        <div key={u.label} className="flex min-w-[3.5rem] flex-col items-center bg-accent px-2 py-2 text-white">
          <span className="font-display text-2xl font-extrabold leading-none tabular-nums">{u.value}</span>
          <span className="mt-1 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
