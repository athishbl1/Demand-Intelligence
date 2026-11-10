"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Compass, LogIn, Rocket, Sparkles, UserPlus } from "lucide-react";
import { Countdown } from "@/components/ui/Countdown";
import { useScrolled } from "@/components/ui/hooks";
import { AlertBell } from "@/components/agent/AlertBell";
import { AlertToast } from "@/components/agent/AlertToast";
import { useAlerts } from "@/lib/useAlerts";
import { useT } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";

const NAV = [
  { href: "/", label: "Overview", Icon: Compass },
  { href: "/dashboard", label: "Season Dashboard", Icon: LayoutDashboard },
  { href: "/explain", label: "Explain", Icon: Sparkles },
  { href: "/strategies", label: "Strategies", Icon: Rocket },
];

/** 2px crimson bar along the bottom edge of the header, showing how far the page has scrolled. */
function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <span
      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent"
      style={{ transform: `scaleX(${p})` }}
      aria-hidden="true"
    />
  );
}

export function Header() {
  const pathname = usePathname();
  const scrolled = useScrolled(12);
  const alerts = useAlerts("open");
  const t = useT();

  return (
    <>
      {/* Dark live-info strip */}
      <div className="bg-slate-900 text-white">
        <div className="container-page flex h-9 items-center justify-between gap-4 text-[11px]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0 items-center gap-2 font-display font-extrabold uppercase tracking-[0.14em] text-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {t("Live info")}
            </span>
            <span className="hidden truncate text-white/70 md:inline">
              {t("Paznaun-Ischgl · 22,078 beds monitored · Winter 2026/27 forecast, updated live")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-white/90">
            <span className="hidden font-display font-bold uppercase tracking-[0.14em] text-white/60 sm:inline">{t("Season start in")}</span>
            <Countdown variant="inline" />
          </div>
        </div>
      </div>

      {/* Sticky white header */}
      <header
        className={`sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled
            ? "border-transparent bg-white/90 shadow-[0_8px_24px_-12px_rgb(17_17_17/0.18)] backdrop-blur-lg"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="container-page flex h-16 items-center justify-end gap-3">
          <nav className="flex w-full items-center justify-between gap-1 sm:gap-2" aria-label={t("Main")}>
            {NAV.map(({ href, label, Icon }) => {
              // Sub-pages (/strategies/12, /explain?...) keep their section highlighted.
              const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={t(label)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-16 items-center gap-1.5 px-2.5 font-display text-xs font-extrabold uppercase tracking-wider transition-colors sm:px-3 ${
                    active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} aria-hidden="true" />
                  <span className="hidden sm:inline">{t(label)}</span>
                  <span
                    className={`absolute inset-x-2.5 bottom-0 h-[3px] origin-left bg-accent transition-transform duration-300 sm:inset-x-3 ${
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}

            <AlertBell unread={alerts.unread} active={pathname.startsWith("/alerts")} />
            <span className="ml-1 flex items-center gap-1.5 border-l border-slate-200 pl-2 sm:ml-2 sm:pl-3">
              <LangToggle />
              <ThemeToggle />
            </span>

          </nav>
        </div>
        <ScrollProgress />
      </header>
      <AlertToast alert={pathname.startsWith("/alerts") ? null : alerts.latestNew} onClose={alerts.clearLatest} />
    </>
  );
}
