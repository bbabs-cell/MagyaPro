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
    const stock = variant.inventory.reduce((sum, entry) => sum + toQty(entry.quantity), 0);
    const threshold = toQty(variant.product.minStockAlert);

    if (stock <= 0) alerts.outOfStock += 1;
    else if (threshold > 0 && stock <= threshold) alerts.lowStock += 1;

    const expiry = expiryState(expiryByVariant.get(variant.id) ?? null, now);
    if (expiry === 'expired') alerts.expired += 1;
    else if (expiry !== 'ok') alerts.expiringSoon += 1;
  }

  return alerts;
}
