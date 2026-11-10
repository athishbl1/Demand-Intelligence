"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Bell in the header with the number of unread alerts. */
export function AlertBell({ unread, active }: { unread: number; active: boolean }) {
  const t = useT();
  const label = unread ? t("Alerts, {n} unread", { n: unread }) : t("Alerts");
  return (
    <Link
      href="/alerts"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-16 items-center gap-1.5 px-2.5 font-display text-xs font-extrabold uppercase tracking-wider transition-colors sm:px-3 ${
        active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <Bell className={`h-4 w-4 ${active || unread ? "text-accent" : ""}`} aria-hidden="true" />
      <span className="hidden sm:inline">{t("Alerts")}</span>
      {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      <span
        className={`absolute inset-x-2.5 bottom-0 h-[3px] origin-left bg-accent transition-transform duration-300 sm:inset-x-3 ${
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
        }`}
        aria-hidden="true"
      />
    </Link>
  );
}
