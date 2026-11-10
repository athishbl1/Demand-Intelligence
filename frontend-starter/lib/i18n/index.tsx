"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DE as DE_MAIN, DE_DASH, DE_MORE } from "./de";

const DE: Record<string, string> = { ...DE_DASH, ...DE_MORE, ...DE_MAIN };

export type Lang = "en" | "de";
const KEY = "ttf-lang";

type Vars = Record<string, string | number>;
export type TFn = (text: string, vars?: Vars) => string;

/**
 * The language the page currently renders in. LangProvider sets it while rendering and the app remounts
 * on a language change (see LangBoundary), so plain functions in lib/ can call tr() / activeLocale()
 * without a hook.
 */
let active: Lang = "en";
export const getLang = () => active;
export const activeLocale = () => (active === "de" ? "de-AT" : "en-GB");
export const tr: TFn = (text, vars) => translate(active, text, vars);

/** English text is the key. German comes from the dictionary in ./de.ts; anything missing stays English. */
export function translate(lang: Lang, text: string, vars?: Vars): string {
  let out = lang === "de" ? (DE[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
  /** Locale for numbers and dates */
  locale: string;
}

const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s, v) => translate("en", s, v), locale: "en-GB" });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  active = lang;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "de" || saved === "en") setLangState(saved);
      else if (navigator.language?.toLowerCase().startsWith("de")) setLangState("de");
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (s, v) => translate(lang, s, v), locale: lang === "de" ? "de-AT" : "en-GB" }),
    [lang, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;

/** Remounts the page when the language changes, so every number, date and text is rebuilt in the new language. */
export function LangBoundary({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  return <Fragment key={lang}>{children}</Fragment>;
}
