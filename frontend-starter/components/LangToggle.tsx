"use client";

import { useLang } from "@/lib/i18n";

/** EN | DE switch */
export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="inline-flex h-9 border border-slate-200 font-display text-[11px] font-extrabold" role="group" aria-label={t("Language")}>
      {(["en", "de"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          aria-label={l === "en" ? "English" : "Deutsch"}
          onClick={() => setLang(l)}
          className={`px-2.5 uppercase tracking-wider transition-colors ${
            lang === l ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
