/**
 * Inventaire guidé — calculs partagés par l'écran de comptage et le serveur.
 *
 * Le principe qui guide tout le reste : on n'écrit jamais « le stock vaut
 * maintenant N ». On écrit l'**écart** constaté au moment du comptage
 * (`compté − attendu`), appliqué au stock tel qu'il est à la validation.
 *
 * La différence compte dès qu'une vente a lieu pendant l'inventaire, ce qui
 * est la règle dans une boutique qui reste ouverte : on compte 12 bouteilles
 * à 10 h (le logiciel en attendait 15), on en vend 2 à 10 h 30, on valide à
 * 11 h. Écrire « 12 » effacerait les deux ventes ; appliquer l'écart (−3)
 * donne 10, ce qu'il y a réellement en rayon.
 */

/** Saisie d'un comptage : une quantité par unité (« 3 cartons + 4 bouteilles »). */
export type CountParts = Record<string, string>;

export type CountUnit = {
  unitId: string;
  factor: number;
  isBase: boolean;
};

/** Arrondi à la précision de stockage (6 décimales). */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Quantité comptée, en unité de base. `null` tant que rien n'est saisi — un
 * champ vide n'est pas un zéro : « pas encore compté » et « il n'en reste
 * plus » sont deux réponses différentes, et seule la seconde corrige le stock.
 */
export function countedBaseQuantity(parts: CountParts, units: CountUnit[]): number | null {
  let total = 0;
  let any = false;
  for (const unit of units) {
    const raw = parts[unit.unitId];
    if (raw === undefined || raw.trim() === '') continue;
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return null;
    total += value * unit.factor;
    any = true;
  }
  return any ? round6(total) : null;
}

/** Écart d'un comptage : positif quand on trouve plus que prévu. */
export function countDifference(counted: number, expected: number): number {
  return round6(counted - expected);
}

export type CountLine = {
  variantId: string;
  counted: number;
  expected: number;
  /** Coût d'achat d'une unité de base, en unité mineure. */
  unitCost: number;
};

export type CountSummary = {
  counted: number;
  matching: number;
  withGap: number;
  /** Valeur au coût d'achat de ce qui manque (positif). */
  missingValue: number;
  /** Valeur au coût d'achat de ce qui a été trouvé en trop. */
  surplusValue: number;
};

export function summarizeCount(lines: CountLine[]): CountSummary {
  const summary: CountSummary = { counted: 0, matching: 0, withGap: 0, missingValue: 0, surplusValue: 0 };
  for (const line of lines) {
    summary.counted += 1;
    const gap = countDifference(line.counted, line.expected);
    if (gap === 0) {
      summary.matching += 1;
      continue;
    }
    summary.withGap += 1;
    const value = Math.round(Math.abs(gap) * line.unitCost);
    if (gap < 0) summary.missingValue += value;
    else summary.surplusValue += value;
  }
  return summary;
}

/** Motif inscrit dans l'historique des mouvements — relu des mois plus tard. */
export function stockCountReason(counted: number, expected: number, note?: string | null): string {
  const format = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  return [`Inventaire : compté ${format(counted)}, attendu ${format(expected)}`, note?.trim() || null]
    .filter(Boolean)
    .join(' — ');
}
