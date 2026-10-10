import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Site language (EN / NO). Stored in localStorage like before, but shared
 * through context so every page - not just the navbar - follows the toggle.
 * Norwegian Academy articles also live at their own /no/academy URLs so
 * search engines can index both languages; visiting one switches the UI
 * to Norwegian.
 */
export type Lang = 'EN' | 'NO';

const STORAGE_KEY = 'sievoo_lang';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Pick the string for the current language. */
  t: (en: string, no: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'EN';
  if (window.location.pathname.startsWith('/no/')) return 'NO';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'EN' || saved === 'NO') return saved;
  } catch {
    // storage unavailable - fall through
  }
  return /^(nb|nn|no)\b/i.test(navigator.language ?? '') ? 'NO' : 'EN';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'NO' ? 'nb' : 'en';
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: (en, no) => (lang === 'NO' ? no : en) }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}
