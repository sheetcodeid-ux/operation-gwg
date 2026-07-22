"use client";

import * as React from "react";
import { translate, type Lang } from "./dict";
import { translateTerm } from "./domain";

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  /** Translate a data-driven domain term (checklist item, section, rating). */
  td: (label: string) => string;
}

const I18nCtx = React.createContext<I18nValue | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(initialLang);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `gwg_lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = React.useCallback((key: string) => translate(lang, key), [lang]);
  const td = React.useCallback((label: string) => translateTerm(lang, label), [lang]);

  return <I18nCtx.Provider value={{ lang, setLang, t, td }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nCtx);
  if (!ctx) return { lang: "en" as Lang, setLang: () => {}, t: (k: string) => translate("en", k), td: (l: string) => l };
  return ctx;
}
