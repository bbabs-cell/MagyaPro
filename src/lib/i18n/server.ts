import { cookies, headers } from 'next/headers';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n/locales';
import { getDictionary } from '@/lib/i18n/dictionary';

/**
 * Langue courante du visiteur.
 *
 * Deux sources, dans cet ordre :
 *
 * 1. **L'URL** (`?lang=en`), transmise par le middleware dans `x-locale`.
 *    Elle prime parce qu'elle est explicite et, surtout, parce qu'elle est la
 *    seule qu'un moteur de recherche puisse suivre : les robots n'envoient
 *    pas de cookie, donc sans elle les traductions n'existaient pour aucun
 *    moteur.
 * 2. **Le cookie de préférence**, posé par le sélecteur de langue. C'est le
 *    confort d'un visiteur humain qui revient.
 *
 * Les deux valeurs sont validées contre la liste des langues connues ; tout
 * le reste retombe sur le français.
 */
export async function resolveLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const fromUrl = requestHeaders.get('x-locale');
  if (isLocale(fromUrl)) return fromUrl;

  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getServerDictionary() {
  const locale = await resolveLocale();
  return { locale, dict: getDictionary(locale) };
}
