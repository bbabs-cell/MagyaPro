import { ValidationError } from '@/lib/errors';

/**
 * Déclinaisons d'un produit (tailles, pointures, couleurs).
 *
 * Un produit déclare ses *axes* (`StoreProduct.variantAxes`) et chaque
 * variante choisit une valeur par axe dans son `attributes`. Les axes sont
 * déclarés plutôt que déduits des variantes existantes : sans eux, la caisse
 * ne saurait pas quelles pastilles afficher ni dans quel ordre, et une taille
 * momentanément en rupture disparaîtrait de l'écran au lieu d'apparaître
 * grisée.
 *
 * Le stock reste porté par la variante, jamais par le produit : vendre un
 * t-shirt en M ne doit pas entamer le stock des L.
 */

export type VariantAxis = { name: string; values: string[] };

/** Lit les axes depuis le JSON de la fiche, en ignorant toute forme inattendue. */
export function parseVariantAxes(raw: unknown): VariantAxis[] {
  if (!Array.isArray(raw)) return [];
  const axes: VariantAxis[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, values } = entry as { name?: unknown; values?: unknown };
    if (typeof name !== 'string' || !Array.isArray(values)) continue;
    const cleaned = values.filter((value): value is string => typeof value === 'string');
    if (cleaned.length > 0) axes.push({ name, values: cleaned });
  }
  return axes;
}

/**
 * Toutes les combinaisons possibles des axes, dans l'ordre de déclaration —
 * « S/Noir, S/Blanc, M/Noir… ». C'est ce que le générateur de matrice propose
 * de créer d'un coup ; le commerçant reste libre d'en retirer.
 */
export function buildCombinations(axes: VariantAxis[]): Array<Record<string, string>> {
  if (axes.length === 0) return [];
  return axes.reduce<Array<Record<string, string>>>(
    (combinations, axis) =>
      combinations.flatMap((combination) =>
        axis.values.map((value) => ({ ...combination, [axis.name]: value })),
      ),
    [{}],
  );
}

/** Clé stable d'une combinaison, pour comparer deux variantes entre elles. */
export function combinationKey(attributes: Record<string, string>, axes: VariantAxis[]): string {
  return axes.map((axis) => `${axis.name}=${attributes[axis.name] ?? ''}`).join('|');
}

/** Libellé lisible d'une déclinaison — « M · Noir ». */
export function variantLabel(
  attributes: Record<string, string>,
  axes: VariantAxis[],
): string | null {
  const parts = axes.map((axis) => attributes[axis.name]).filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Vérifie qu'un lot de déclinaisons est cohérent avec les axes déclarés :
 * une valeur par axe, prise dans la liste, et jamais deux fois la même
 * combinaison. Une incohérence ici produirait des variantes invendables
 * (invisibles en caisse faute de pastille correspondante).
 */
export function assertVariantsMatchAxes(
  axes: VariantAxis[],
  variants: Array<{ attributes: Record<string, string> }>,
): void {
  if (axes.length === 0) return;

  const seen = new Set<string>();
  for (const variant of variants) {
    for (const axis of axes) {
      const value = variant.attributes[axis.name];
      if (!value) {
        throw new ValidationError(`Une déclinaison n'a pas de valeur pour « ${axis.name} ».`);
      }
      if (!axis.values.includes(value)) {
        throw new ValidationError(
          `« ${value} » ne fait pas partie des valeurs de « ${axis.name} ».`,
        );
      }
    }

    const key = combinationKey(variant.attributes, axes);
    if (seen.has(key)) {
      throw new ValidationError(
        `La déclinaison « ${variantLabel(variant.attributes, axes)} » est présente deux fois.`,
      );
    }
    seen.add(key);
  }
}
