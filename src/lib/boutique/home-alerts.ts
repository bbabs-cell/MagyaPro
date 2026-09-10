import { prisma } from '@/lib/db';
import { toQty } from '@/lib/boutique/quantity';
import { loadEarliestExpiry } from '@/lib/boutique/expiry-load';
import { expiryState } from '@/lib/boutique/expiry';

/**
 * Ce qui demande une action, pour la vue d'ensemble.
 *
 * Ces informations existaient déjà, éparpillées entre Prévisions, Produits et
 * Analyses. Il fallait ouvrir trois écrans pour savoir s'il y avait un
 * problème — alors que la vue d'ensemble est justement la page qu'on ouvre en
 * arrivant. Elle ne montrait que le passé : trente jours de chiffre
 * d'affaires, aucune alerte.
 *
 * Rien n'est recalculé autrement qu'ailleurs : mêmes règles, mêmes seuils.
 */
export type HomeAlerts = {
  /** Références actives dont le stock est à zéro. */
  outOfStock: number;
  /** Références sous leur seuil d'alerte, mais pas encore en rupture. */
  lowStock: number;
  /** Références portant au moins un lot périmé. */
  expired: number;
  /** Références dont un lot périme dans les trente jours. */
  expiringSoon: number;
};

/**
 * État de stock d'une référence, à partir de son stock total et de son seuil.
 *
 * Extrait en fonction pure parce que c'est la règle qui décide de ce qu'un
 * commerçant voit en rouge sur sa première page, et qu'elle est trop facile à
 * réinterpréter de travers. Une page l'a d'ailleurs déjà fait : « Toutes les
 * boutiques » comptait les ruptures dans le stock bas, si bien que le même
 * commerçant lisait deux chiffres différents pour la même chose.
 *
 * Trois subtilités que les tests figent :
 *
 * - une référence sans aucune ligne de stock vaut zéro, donc rupture. C'est le
 *   cas d'un produit créé mais jamais réceptionné ;
 * - un seuil à zéro désactive l'alerte de stock bas, il ne la déclenche pas à
 *   la moindre unité. Zéro veut dire « je ne veux pas d'alerte » ;
 * - le stock est comparé au seuil inclus : à seuil égal, on alerte. Le seuil
 *   est le moment de recommander, pas celui d'être déjà en dessous.
 */
export type StockAlertState = 'out' | 'low' | 'ok';

export function stockAlertState(stock: number, threshold: number): StockAlertState {
  if (stock <= 0) return 'out';
  if (threshold > 0 && stock <= threshold) return 'low';
  return 'ok';
}

export async function getStoreHomeAlerts(storeId: string): Promise<HomeAlerts> {
  const now = Date.now();

  const [variants, expiryByVariant] = await Promise.all([
    prisma.storeProductVariant.findMany({
      // Une fiche archivée ou en brouillon n'est pas en vente : la signaler en
      // rupture serait du bruit sur la première page de l'application.
      where: { isActive: true, product: { storeId, status: 'ACTIVE' } },
      select: {
        id: true,
        product: { select: { minStockAlert: true } },
        inventory: { select: { quantity: true } },
      },
    }),
    loadEarliestExpiry(storeId),
  ]);

  const alerts: HomeAlerts = { outOfStock: 0, lowStock: 0, expired: 0, expiringSoon: 0 };

  for (const variant of variants) {
    // Le stock d'une référence est la somme de ses emplacements : une boutique
    // peut tenir la même référence en réserve et en rayon.
    const stock = variant.inventory.reduce((sum, entry) => sum + toQty(entry.quantity), 0);
    const threshold = toQty(variant.product.minStockAlert);

    const state = stockAlertState(stock, threshold);
    if (state === 'out') alerts.outOfStock += 1;
    else if (state === 'low') alerts.lowStock += 1;

    const expiry = expiryState(expiryByVariant.get(variant.id) ?? null, now);
    if (expiry === 'expired') alerts.expired += 1;
    else if (expiry !== 'ok') alerts.expiringSoon += 1;
  }

  return alerts;
}
