"use client";

import React from "react";
import Link from "next/link";
import { APP } from "@/lib/app";
import { ArrowRight, Radio, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { MountainScene } from "@/components/ui/MountainScene";
import { Snowfall } from "@/components/ui/Snowfall";
import { useLiveDashboard, useNow } from "@/components/landing/useLive";
import { LiveHeroCard } from "@/components/landing/LiveHeroCard";
import { LiveKpiBand } from "@/components/landing/LiveKpiBand";
import { WeeksRadar } from "@/components/landing/WeeksRadar";
import { useT } from "@/lib/i18n";

function SectionHead({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-12">
      <div className="max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-4 text-[2rem] leading-none sm:text-5xl">{title}</h2>
        {lead && <p className="mt-4 text-slate-500">{lead}</p>}
      </div>
      {children}
    </Reveal>
  );
}

export default function LandingPage() {
  const t = useT();
  const { data, source, loading, updatedAt } = useLiveDashboard(60_000);
  const now = useNow(1000);

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden border-b border-slate-200 bg-white">
        <div className="bg-dots absolute inset-0 -z-20 opacity-60" aria-hidden="true" />
        <MountainScene variant="light" className="absolute inset-x-0 bottom-0 -z-10 h-[45%] w-full" />
        <Snowfall density={60} />

        <div className="container-page relative grid items-center gap-12 pb-32 pt-14 sm:pb-40 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-fade-up">
            <span className="eyebrow">{t("TVB Paznaun-Ischgl · Demand Intelligence")}</span>

            <h1 className="mt-6 text-[2.5rem] font-black leading-none sm:text-6xl xl:text-[4.25rem]">
              {t("Overnight data,")} <br />
              <span className="text-accent">{t("finally explained.")}</span>
            </h1>

            <p className="mt-7 max-w-[56ch] text-base text-slate-600 sm:text-lg">
              {t("Destinations track overnight stays and forecasts, but deviations often remain unexplained.")}{" "}
              <strong className="text-slate-900">{APP.name}</strong> {t("decodes the gap using weather, school holidays and regional events, and turns it into a ranked action plan before the week is lost.")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="btn">
                {t("Open the season dashboard")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
              <li className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{t("Refreshed every minute")}</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{t("Every number traceable to its source")}</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-accent" />{data ? t("{d} days · {w} weeks", { d: data.days.length, w: data.weeks.length }) : t("Loading series …")}</li>
            </ul>
          </div>

          <div className="animate-fade-up [animation-delay:150ms]">
            <LiveHeroCard data={data} source={source} loading={loading} updatedAt={updatedAt} now={now} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ live KPIs */}
      <section className="bg-white pb-12 sm:pb-16">
        <div className="container-page relative z-10 -mt-16">
          <LiveKpiBand data={data} />
        </div>
      </section>

      {/* ------------------------------------------------------------ weeks ahead */}
      <section id="weeks" className="scroll-mt-32 py-16 sm:py-24">
        <div className="container-page">
          <SectionHead
            eyebrow={t("Forward radar")}
            title={t("The next eight season weeks")}
            lead={t("Forecast against last year with a clear stance per week, starting with the first open week. Click a week to open it in the dashboard.")}
          />
          <WeeksRadar data={data} />
        </div>
      </section>
    </div>
  );
}
