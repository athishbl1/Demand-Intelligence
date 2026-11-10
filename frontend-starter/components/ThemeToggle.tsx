"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useT } from "@/lib/i18n";

const KEY = "ttf-theme";

/** Light / dark switch. The first paint is handled by the inline script in app/layout.tsx. */
export function ThemeToggle() {
  const t = useT();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? t("Switch to light mode") : t("Switch to dark mode")}
      title={dark ? t("Light mode") : t("Dark mode")}
      className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
