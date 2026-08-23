/**
 * Unités de produit Boutique — fichier sans dépendance serveur (à la
 * différence de `quantity.ts`, qui importe `@prisma/client`) afin de rester
 * importable depuis des composants client sans alourdir leur bundle.
 */

export const UNIT_LABELS: Record<string, string> = {
  UNIT: 'pièce(s)',
  KG: 'kg',
  GRAM: 'g',
  LITER: 'L',
  MILLILITER: 'mL',
  PACK: 'pack(s)',
};

/**
 * Unités vendues au poids/volume, où une quantité fractionnaire a un sens
 * (1,5 kg, 0,25 L) — à la différence d'un article compté à la pièce ou au
 * pack, où seul un nombre entier est plausible.
 */
const DECIMAL_UNITS = new Set(['KG', 'GRAM', 'LITER', 'MILLILITER']);

export function isDecimalUnit(unit: string): boolean {
  return DECIMAL_UNITS.has(unit);
}

/** Pas de saisie/incrément adapté à l'unité, pour les champs numériques. */
export function quantityStep(unit: string): number {
  return isDecimalUnit(unit) ? 0.001 : 1;
}
