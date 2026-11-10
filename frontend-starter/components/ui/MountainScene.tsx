"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./hooks";

/**
 * Layered alpine ridges with snow caps. The layers drift with the pointer (parallax).
 * "light": grey ridges for the white hero. "brand": translucent white ridges for crimson banners.
 */
export function MountainScene({ variant = "light", className = "" }: { variant?: "light" | "brand"; className?: string }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || prefersReducedMotion()) return;
    const layers = Array.from(svg.querySelectorAll<SVGGElement>("[data-depth]"));
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const l of layers) {
          const d = Number(l.dataset.depth);
          l.style.transform = `translate(${(-x * d).toFixed(1)}px, ${(-y * d * 0.4).toFixed(1)}px)`;
        }
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const fills =
    variant === "light"
      ? ["#eceff2", "#d6dce2", "#bec6cf"]
      : ["rgb(255 255 255 / 0.08)", "rgb(255 255 255 / 0.12)", "rgb(255 255 255 / 0.18)"];
  const snow = variant === "light" ? "#ffffff" : "rgb(255 255 255 / 0.35)";

  return (
    <svg
      ref={ref}
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <g data-depth="10" style={{ transition: "transform .6s cubic-bezier(.22,1,.36,1)" }}>
        <path
          fill={fills[0]}
          d="M-40 420V250l140-90 90 50 150-140 120 95 80-40 170 150 130-110 150 120 110-70 160 110 140-90 90 60v185z"
        />
      </g>
      <g data-depth="22" style={{ transition: "transform .6s cubic-bezier(.22,1,.36,1)" }}>
        <path fill={fills[1]} d="M-40 420V300l190-130 120 90 170-170 210 190 150-100 190 140 160-120 190 130 150-80v270z" />
        <path fill={snow} d="M440 90l-58 57 22 6 18-16 14 20 20-22 22 15 22-8zM1000 140l-48 36 18 4 16-12 16 14 18-10 24 6z" />
      </g>
      <g data-depth="40" style={{ transition: "transform .6s cubic-bezier(.22,1,.36,1)" }}>
        <path fill={fills[2]} d="M-40 420V360l230-150 160 110 200-200 230 210 170-110 220 160 180-90 160 100v30z" />
        <path fill={snow} d="M590 120l-66 64 26 6 20-18 18 22 22-24 26 18 22-6zM1170 230l-52 30 20 4 14-10 18 14 18-12 20 6z" />
      </g>
    </svg>
  );
}
