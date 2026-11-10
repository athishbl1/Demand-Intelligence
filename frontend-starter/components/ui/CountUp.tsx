"use client";

import { useEffect, useState } from "react";
import { getLang } from "@/lib/i18n";
import { prefersReducedMotion, useInView } from "./hooks";

/**
 * Counts a formatted number up from zero once visible. Understands prefixes,
 * suffixes and separators: "€3.45M", "22,078", "+12%", "95.6%", "517 Days".
 * The server render and the final state show the exact original text.
 */
export function CountUp({ value, duration = 1200, className = "" }: { value: string; duration?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [text, setText] = useState(value);

  useEffect(() => {
    if (!inView || prefersReducedMotion() || getLang() !== "en") return;
    const m = value.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
    if (!m) return;
    const [, pre, num, post] = m;
    const target = parseFloat(num.replace(/,/g, ""));
    const decimals = num.includes(".") ? num.split(".")[1].length : 0;
    const grouped = num.includes(",");
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = (target * eased).toFixed(decimals);
      const shown = grouped ? Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n;
      setText(p < 1 ? `${pre}${shown}${post}` : value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`} aria-label={value}>
      {text}
    </span>
  );
}
