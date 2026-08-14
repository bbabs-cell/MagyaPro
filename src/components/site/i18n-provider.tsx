'use client';

import { createContext, useContext, useMemo } from 'react';

import type { Locale } from '@/lib/i18n/locales';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionary';

type I18nValue = { locale: Locale; dict: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Le dictionnaire contient des fonctions (pluriels, interpolation) : il ne
 * peut pas traverser la frontière serveur → client comme une prop React
 * normale (React ne sérialise pas les fonctions). Seule la langue, une simple
 * chaîne, est transmise depuis le composant serveur ; le dictionnaire
 * correspondant est reconstruit ici, côté client, à partir du même module.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const dict = useMemo(() => getDictionary(locale), [locale]);
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

/** Dictionnaire et langue courante, côté client. */
export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n doit être utilisé à l\'intérieur d\'un I18nProvider.');
  }
  return context;
}
