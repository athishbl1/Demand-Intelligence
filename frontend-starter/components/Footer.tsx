"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

const COLUMNS = [
  {
    title: "Dashboard",
    links: [
      { label: "Season overview", href: "/dashboard#overview" },
      { label: "Weeks", href: "/dashboard#weeks" },
      { label: "Holidays", href: "/dashboard#calendar" },
    ],
  },
  {
    title: "Insights",
    links: [
      { label: "Explain a change", href: "/explain" },
      { label: "Alerts", href: "/alerts" },
    ],
  },
];

export function Footer() {
  const t = useT();
  return (
    <footer className="relative mt-24 overflow-hidden bg-slate-50">
      {/* Huge outlined watermark */}
      <span
        className="text-outline pointer-events-none absolute -bottom-[3vw] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[18vw] font-black uppercase leading-none text-slate-200"
        aria-hidden="true"
      >
        Paznaun
      </span>

      <div className="container-page relative grid gap-10 py-16 sm:grid-cols-3">
        <div className="flex flex-col gap-4">
          <p className="max-w-xs text-sm text-slate-500">
            {t("Explainable overnight forecasting and an early-action playbook for TVB Paznaun-Ischgl.")}
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-slate-900">{t(c.title)}</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-slate-600 hover:text-accent">
                    {t(l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative border-t border-slate-200 bg-white">
        <div className="container-page flex flex-col items-start justify-between gap-2 py-5 text-xs text-slate-500 md:flex-row md:items-center">
          <span>
            © 2026 <b className="font-display uppercase tracking-wide text-slate-900">{t("Demand Intelligence")}</b> · Paznaun-Ischgl
          </span>
          <span className="flex items-start gap-2 md:items-center">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent md:mt-0" aria-hidden="true" />
            {t("Data")}: TVB Paznaun-Ischgl / Feratel · Contwise (CC-BY) · JOANNEUM Research · OpenHolidays (ODbL) · Open-Meteo (CC BY 4.0)
          </span>
        </div>
      </div>
    </footer>
  );
}
