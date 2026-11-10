"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useStrategySet } from "@/lib/useStrategySet";
import { MODE_PLAIN } from "@/lib/strategy";
import { StrategyView } from "@/components/strategy/StrategyView";

export default function StrategySetPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const x = useStrategySet(Number.isInteger(id) && id > 0 ? id : null);
  const s = x.data;

  return (
    <div className="container-page flex flex-col gap-6 py-10 sm:py-14">
      <nav className="flex items-center gap-1.5 text-sm text-muted" aria-label={t("Breadcrumb")}>
        <Link href="/strategies" className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-accent">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("Strategies")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate">{s ? `${s.explanation.scope.label} → ${s.target.label}` : t("Plan")}</span>
      </nav>

      <header className="min-w-0">
        <span className="eyebrow">{t("Campaign strategist · AI agent")}</span>
        <h1 className="page-title mt-3">{s ? t(MODE_PLAIN[s.mode].title) : t("Campaign plan")}</h1>
      </header>

      {(x.error || !(id > 0)) && (
        <div className="notice-error text-sm" role="alert">
          <b>{t("The plan could not be loaded.")}</b> {x.error ?? t("This plan does not exist.")}
        </div>
      )}
      {x.busy === "load" && !s && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="skeleton h-72" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-96" />)}
          </div>
        </div>
      )}
      {s && <StrategyView s={s} busy={x.busy} onOpen={x.open} onReanalyse={x.reanalyse} onCustom={x.custom} onDecide={x.decide} />}
    </div>
  );
}
