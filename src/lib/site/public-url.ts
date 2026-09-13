import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';
import { env } from '@/lib/env';

/**
 * Adresse publique d'une vitrine, et ses variantes de langue.
 *
 * Une même vitrine est joignable par plusieurs chemins : le domaine
 * personnalisé du restaurant, son sous-domaine, et `/r/<slug>` sur le domaine
 * de la plateforme pour la prévisualisation. Sans indication, un moteur de
 * recherche voit là plusieurs sites identiques et répartit le crédit entre eux
 * au lieu de le concentrer sur un seul.
 *
 * Ce module dit laquelle de ces adresses fait foi. Il vit à part parce que le
 * sitemap et les métadonnées en ont besoin tous les deux : la même règle
 * recopiée à deux endroits finit par diverger — c'est arrivé trois fois dans
 * ce projet.
 */

/** Paramètre de langue accepté dans l'URL. Voir `localeUrl` ci-dessous. */
export const LOCALE_PARAM = 'lang';

/**
 * Base publique de la vitrine, sans barre oblique finale.
 *
 * `pathname` est le chemin **tel que demandé**, avant la réécriture du
 * middleware : il commence par `/r/<slug>` quand la requête vise directement
 * la plateforme, et par le chemin nu (`/menu`) quand elle arrive par le
 * domaine du restaurant.
 */
export function publicSiteBase(hostHeader: string, pathname: string, slug: string): string {
  // La requête vise la plateforme : l'adresse de référence reste `/r/<slug>`.
  if (pathname.startsWith('/r/')) return `${env.appUrl}/r/${slug}`;

  const host = hostHeader.trim().toLowerCase();
  if (!host) return `${env.appUrl}/r/${slug}`;

  const protocol = env.isProduction ? 'https' : 'http';
  return `${protocol}://${host}`;
}

/**
 * Chemin à l'intérieur de la vitrine, débarrassé du préfixe `/r/<slug>`.
 *
 * `/r/la-terrasse/menu` et `menu` sur le domaine du restaurant désignent la
 * même page : le `hreflang` doit produire la même liste dans les deux cas.
 */
export function pathWithinSite(pathname: string, slug: string): string {
  const prefix = `/r/${slug}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return path === '/' ? '' : path;
}

/**
 * URL d'une page dans une langue donnée.
 *
 * La langue du visiteur vit dans un cookie, ce qui convient à un humain qui
 * clique sur le sélecteur — mais **un moteur de recherche n'envoie pas de
 * cookie**. Sans une URL par langue, les traductions anglaise et arabe
 * n'existent pour aucun moteur : elles ne sont jamais servies, donc jamais
 * indexées.
 *
 * Le français, langue par défaut, garde l'URL nue : c'est elle qui fait
 * référence, et lui coller un paramètre créerait un doublon de la page
 * d'accueil.
 */
export function localeUrl(base: string, path: string, locale: Locale): string {
  const url = `${base}${path}`;
  if (locale === DEFAULT_LOCALE) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${LOCALE_PARAM}=${locale}`;
}

/**
 * Table `hreflang` d'une page : une entrée par langue, plus `x-default`.
 *
 * `x-default` désigne la version servie à un visiteur dont la langue n'est
 * couverte par aucune des trois — ici le français.
 */
export function languageAlternates(base: string, path: string): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) {
    alternates[locale] = localeUrl(base, path, locale);
  }
  alternates['x-default'] = localeUrl(base, path, DEFAULT_LOCALE);
  return alternates;
}

/** Étiquette Open Graph d'une langue — `og:locale` attend `fr_FR`, pas `fr`. */
export const OG_LOCALES: Record<Locale, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  ar: 'ar_AR',
};
