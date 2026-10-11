/**
 * Nombres affichés hors montants — pourcentages, notes, taux.
 *
 * `toFixed()` et l'interpolation brute écrivent toujours à l'anglaise :
 * « +172.3 % », « 4.5/5 ». Le français attend une virgule, et une espace
 * insécable avant le signe pour cent, sans quoi « % » peut partir seul à la
 * ligne. Même normalisation des espaces que `formatMoney`, pour que serveur
 * et navigateur produisent la même chaîne à l'hydratation.
 */

const NARROW_NBSP = /\u202f/g;
const NBSP = '\u00a0';

/**
 * Langue de formatage. L'arabe garde les chiffres latins, comme les prix du
 * même site (formatés en `fr-FR`) : deux systèmes de chiffres sur une même
 * fiche gêneraient la lecture plus qu'ils n'aident.
 */
function numberLocale(locale: string): string {
  return locale === 'ar' ? 'ar-u-nu-latn' : locale;
}

/** Nombre à décimales fixes, dans la langue donnée (`4,5` en français). */
export function formatDecimal(value: number, digits = 1, locale = 'fr'): string {
  try {
    return new Intl.NumberFormat(numberLocale(locale), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
      .format(value)
      .replace(NARROW_NBSP, NBSP);
  } catch {
    return value.toFixed(digits);
  }
}

/**
 * Pourcentage déjà exprimé en points (`172.3` → « 172,3 % »). Avec
 * `signed`, une valeur positive porte son « + » : une variation se lit dans
 * les deux sens.
 */
export function formatPercent(
  value: number,
  { digits = 1, signed = false, locale = 'fr' }: { digits?: number; signed?: boolean; locale?: string } = {},
): string {
  const rounded = Number(value.toFixed(digits));
  // Une décimale nulle n'apporte rien : « 25 % » plutôt que « 25,0 % ».
  const shown = Number.isInteger(rounded) ? 0 : digits;
  const sign = signed && rounded > 0 ? '+' : '';
  return `${sign}${formatDecimal(rounded, shown, locale)}${NBSP}%`;
}
