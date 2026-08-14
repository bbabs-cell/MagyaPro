import type { Locale } from '@/lib/i18n/locales';

/**
 * Choisit la traduction saisie par le restaurant pour la langue courante,
 * avec repli sur le champ français de base si aucune traduction n'a été
 * renseignée (jamais de contenu vide affiché).
 */
export function localize(
  base: string,
  translations: Partial<Record<Locale, string | null | undefined>>,
  locale: Locale,
): string {
  return translations[locale] || base;
}

export function localizeNullable(
  base: string | null,
  translations: Partial<Record<Locale, string | null | undefined>>,
  locale: Locale,
): string | null {
  return translations[locale] || base;
}
