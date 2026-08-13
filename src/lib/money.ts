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
export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale = 'fr-FR',
): string {
  const decimals = minorUnits(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(toMajor(amount, currency));
  } catch {
    // Devise inconnue d'Intl : repli lisible plutôt qu'une exception en plein rendu.
    return `${toMajor(amount, currency).toFixed(decimals)} ${currency.toUpperCase()}`;
  }
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
