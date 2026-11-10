"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";
import { useInView } from "./hooks";

/** Fades its content up when it scrolls into view. `delay` in ms for staggered rows (80–120ms apart). */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;
  return (
    <Tag ref={ref} className={`reveal ${inView ? "is-visible" : ""} ${className}`} style={style}>
      {children}
    </Tag>
  );
}
