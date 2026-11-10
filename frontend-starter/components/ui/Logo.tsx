"use client";

import { useState } from "react";
import { Mountain } from "lucide-react";
import { APP } from "@/lib/app";

/** Ischgl logo from APP.logo; falls back to a white mountain in a crimson square if it does not load. */
export function Logo({ className = "h-9" }: { className?: string }) {
  const [failed, setFailed] = useState(!APP.logo);
  if (failed) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent text-white cut-corner">
        <Mountain className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={APP.logo} alt="Ischgl" className={`${className} w-auto max-w-none shrink-0 self-start object-contain`} onError={() => setFailed(true)} />
  );
}
