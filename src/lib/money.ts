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

/**
 * Montants tenus par devise — jamais additionnés entre elles.
 *
 * Une somme qui mêle deux monnaies est un nombre qui ne veut rien dire, et
 * rien à l'écran ne le signale : c'est le pire défaut possible sur de
 * l'argent. La zone visée par ce produit en compte justement deux, le franc
 * CFA d'Afrique de l'Ouest et celui d'Afrique centrale — même nom courant,
 * même valeur face à l'euro, monnaies distinctes.
 *
 * La règle vit ici plutôt que dans un module d'écran : elle vaut pour tout
 * total qui traverse plusieurs commerces ou plusieurs abonnements.
 */
export type MoneyByCurrency = Record<string, number>;

/** Regroupe des montants par devise, sans jamais les mélanger. */
export function sumByCurrency(
  entries: Array<{ amount: number; currency: string }>,
): MoneyByCurrency {
  const totals: MoneyByCurrency = {};
  for (const entry of entries) {
    const code = entry.currency.toUpperCase();
    totals[code] = (totals[code] ?? 0) + entry.amount;
  }
  return totals;
}

/**
 * Devise principale d'un ensemble de montants : celle qui pèse le plus lourd.
 *
 * Les écrans ont besoin d'un chiffre en tête d'affiche. Tant qu'une seule
 * devise circule — le cas de l'immense majorité des commerçants — c'est
 * simplement celle-là ; le jour où une seconde apparaît, la fonction désigne
 * la dominante et l'appelant reste libre d'afficher le reste à côté plutôt que
 * de tout additionner.
 */
export function primaryCurrency(amounts: MoneyByCurrency, fallback = DEFAULT_CURRENCY): string {
  const entries = Object.entries(amounts);
  if (entries.length === 0) return fallback;
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/** Montant dans une devise donnée, zéro si elle n'apparaît pas. */
export function amountIn(amounts: MoneyByCurrency, currency: string): number {
  return amounts[currency.toUpperCase()] ?? 0;
}

/**
 * Fusionne plusieurs répartitions par devise, devise par devise.
 *
 * Sert notamment à retrouver la devise dominante d'une série mensuelle : il
 * faut d'abord réunir tous les mois avant de savoir laquelle pèse le plus.
 */
export function mergeByCurrency(...amounts: MoneyByCurrency[]): MoneyByCurrency {
  const total: MoneyByCurrency = {};
  for (const part of amounts) {
    for (const [code, value] of Object.entries(part)) {
      const key = code.toUpperCase();
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

/** Vrai dès que plus d'une devise est en jeu — donc qu'un total unique mentirait. */
export function hasSeveralCurrencies(amounts: MoneyByCurrency): boolean {
  return Object.keys(amounts).filter((code) => amounts[code] !== 0).length > 1;
}
