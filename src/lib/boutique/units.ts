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

/**
 * Une unité telle que la caisse et les écrans de stock la manipulent —
 * version allégée de `ResolvedUnit` (`units-engine.ts`), sans dépendance
 * serveur, pour traverser la frontière serveur/client.
 */
export type UnitOption = {
  unitId: string;
  label: string;
  labelPlural: string;
  isDecimal: boolean;
  factor: number;
  price: number | null;
  isBase: boolean;
};

/** Accorde le libellé d'une unité selon la quantité. */
export function unitLabelFor(unit: { label: string; labelPlural: string }, quantity: number): string {
  return Math.abs(quantity) >= 2 ? unit.labelPlural : unit.label;
}

/** Pas de saisie adapté à une unité résolue (le carton ne se vend pas au tiers). */
export function stepForUnit(unit: { isDecimal: boolean; isBase: boolean }): number {
  return unit.isDecimal && unit.isBase ? 0.000001 : 1;
}

/**
 * Décompose une quantité exprimée en unité de base vers la plus grande unité
 * qui la contient, puis le reste — « 277 bouteilles » devient « 13 cartons
 * + 17 bouteilles ».
 *
 * Purement décoratif : le stock reste enregistré en unité de base, cette
 * décomposition est recalculée à chaque affichage. Corriger la taille d'un
 * carton change donc l'affichage sans jamais toucher au stock réel.
 *
 * Les unités décimales (kg, mètre) sont volontairement exclues du
 * regroupement : « 1 kg + 500 g » se lit moins bien que « 1,5 kg ».
 */
export function splitIntoUnits(
  baseQuantity: number,
  units: UnitOption[],
): Array<{ quantity: number; label: string }> {
  const base = units.find((unit) => unit.isBase);
  const baseLabel = base ? unitLabelFor(base, baseQuantity) : '';

  if (baseQuantity === 0) {
    return [{ quantity: 0, label: baseLabel }];
  }

  const groupable = units
    .filter((unit) => !unit.isBase && !unit.isDecimal && unit.factor > 1)
    .sort((a, b) => b.factor - a.factor);

  // Une base fractionnable (kg, mètre) se lit mieux telle quelle, et un
  // produit sans conditionnement déclaré n'a rien à regrouper.
  if (groupable.length === 0 || base?.isDecimal || baseQuantity < 0) {
    return [{ quantity: roundDisplay(baseQuantity), label: baseLabel }];
  }

  const parts: Array<{ quantity: number; label: string }> = [];
  let remaining = baseQuantity;

  for (const unit of groupable) {
    const whole = Math.floor(remaining / unit.factor);
    if (whole >= 1) {
      parts.push({ quantity: whole, label: unitLabelFor(unit, whole) });
      remaining -= whole * unit.factor;
    }
  }

  remaining = roundDisplay(remaining);
  if (remaining > 0 || parts.length === 0) {
    parts.push({ quantity: remaining, label: base ? unitLabelFor(base, remaining) : '' });
  }

  return parts;
}

function roundDisplay(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Rendu texte de `splitIntoUnits` — « 13 cartons + 17 bouteilles ». */
export function formatCompositeStock(baseQuantity: number, units: UnitOption[]): string {
  return splitIntoUnits(baseQuantity, units)
    .map((part) => `${part.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} ${part.label}`)
    .join(' + ');
}
