'use client';

import { useRouter } from 'next/navigation';

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, LOCALE_LABELS } from '@/lib/i18n/locales';
import { LOCALE_PARAM } from '@/lib/site/public-url';
import { useI18n } from '@/components/site/i18n-provider';

/**
 * Change la langue du site public.
 *
 * Le cookie retient la préférence d'un visiteur qui revient. Mais depuis que
 * l'URL peut porter `?lang=` — indispensable pour que les moteurs de recherche
 * voient les traductions — **l'URL prime sur le cookie**. Poser seulement le
 * cookie enfermerait donc un visiteur arrivé par `?lang=en` : le sélecteur
 * changerait la préférence, et le paramètre la réimposerait aussitôt.
 *
 * Les deux sont donc mis à jour ensemble. Effet secondaire heureux : l'adresse
 * de la page devient partageable dans la langue affichée.
 */
export function LanguageSwitcher() {
  const router = useRouter();
  const { locale, dict } = useI18n();

  function change(next: string) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;

    const url = new URL(window.location.href);
    // Le français garde l'URL nue : c'est elle qui fait référence pour les
    // moteurs, et lui coller un paramètre créerait un doublon de la page.
    if (next === DEFAULT_LOCALE) url.searchParams.delete(LOCALE_PARAM);
    else url.searchParams.set(LOCALE_PARAM, next);

    router.replace(`${url.pathname}${url.search}`);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="sr-only">{dict.language.label}</span>
      <select
        aria-label={dict.language.label}
        value={locale}
        onChange={(event) => change(event.target.value)}
        className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs text-ink"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
