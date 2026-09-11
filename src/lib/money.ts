/**
 * Manipulation des montants.
 *
 * Tous les montants persistés sont des **entiers en unité mineure** de la
 * devise concernée. Les flottants sont proscrits : `0.1 + 0.2 !== 0.3` produit
 * des écarts de centimes qui deviennent des écarts comptables.
 *
 * Le nombre de décimales dépend de la devise — le franc CFA (XOF) n'en a
 * aucune, l'euro en a deux. `MINOR_UNITS` porte cette table.
 */

const MINOR_UNITS: Record<string, number> = {
  XOF: 0,
  XAF: 0,
  EUR: 2,
  USD: 2,
  MAD: 2,
  NGN: 2,
  GHS: 2,
};

export const DEFAULT_CURRENCY = 'XOF';

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
}

/** Convertit un montant saisi par un humain ("12,50") en unité mineure. */
export function toMinor(input: number | string, currency: string): number {
  const normalized =
    typeof input === 'string' ? Number(input.replace(',', '.').trim()) : input;
  if (!Number.isFinite(normalized)) {
    throw new Error(`Montant invalide : ${String(input)}`);
  }
  const factor = 10 ** minorUnits(currency);
  return Math.round(normalized * factor);
}

/** Convertit une unité mineure en nombre décimal (affichage / export). */
export function toMajor(amount: number, currency: string): number {
  return amount / 10 ** minorUnits(currency);
}

/**
 * Formate un montant pour l'affichage, dans la locale demandée.
 * Utilisé identiquement côté serveur et client pour éviter les écarts
 * d'hydratation React.
 */
/**
 * Symboles de devise, tenus ici plutôt que laissés au navigateur.
 *
 * `Intl` en mode `currency` va chercher le symbole dans les données de langue
 * du moteur, et ces données varient d'un appareil à l'autre. Le même montant
 * s'affichait « 14 362 650 F CFA » dans les pages rendues par le serveur et
 * « 14 362 650 XOF » dans celles rendues par le navigateur d'un téléphone
 * Android, dont les données de langue ne connaissent pas le symbole du franc
 * CFA et retombent sur le code ISO. Deux écritures pour la même monnaie, dans
 * la même application, selon l'écran ouvert.
 *
 * Un commerçant ne doit pas avoir à se demander si « XOF » et « F CFA » sont
 * la même chose. La table ci-dessous est courte et nous appartient : elle rend
 * l'affichage identique partout, quel que soit l'appareil.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  XOF: 'F CFA',
  XAF: 'FCFA',
  EUR: '€',
  USD: '$US',
  MAD: 'MAD',
  NGN: '₦',
  GHS: 'GH₵',
};

/** Symbole affiché pour une devise ; son code ISO si elle n'est pas connue. */
export function currencySymbol(currency: string): string {
  const code = currency.toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? code;
}

const NARROW_NBSP = / /g;
const NBSP = ' ';

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale = 'fr-FR',
): string {
  const decimals = minorUnits(currency);
  const value = toMajor(amount, currency);

  let digits: string;
  try {
    // Mode décimal, et non `currency` : le groupement des milliers et le
    // séparateur décimal restent confiés à la langue — c'est fiable partout —
    // tandis que le symbole, lui, vient de notre table.
    digits = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    digits = value.toFixed(decimals);
  }

  // Les versions récentes séparent les milliers par une espace fine
  // insécable, les anciennes par une espace insécable ordinaire. Normaliser
  // évite que le serveur et le navigateur produisent deux chaînes différentes
  // pour le même montant, ce que React signale à l'hydratation.
  return `${digits.replace(NARROW_NBSP, NBSP)}${NBSP}${currencySymbol(currency)}`;
}

/**
 * Applique un pourcentage à un montant entier.
 * L'arrondi se fait au plus proche, jamais en faveur d'une des parties par
 * construction.
 */
export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

/** Borne un montant dans [0, max] — les totaux ne peuvent pas être négatifs. */
export function clampAmount(amount: number, max?: number): number {
  const lower = Math.max(0, Math.round(amount));
  return max === undefined ? lower : Math.min(lower, max);
}
