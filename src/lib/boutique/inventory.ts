import { prisma } from '@/lib/db';
import { Prisma, type StockMovementType } from '@prisma/client';
import { toQty } from '@/lib/boutique/quantity';
import { createNotification } from '@/lib/notifications';
import { triggerWebhooks } from '@/lib/boutique/webhooks';

/**
 * Point d'entrée unique pour toute modification de stock — jamais
 * d'écriture directe sur `Inventory` ailleurs dans l'application (voir la
 * consigne du schéma : chaque mouvement doit être tracé). Fonctionne aussi
 * bien en dehors d'une transaction (`tx` omis, utilise `prisma` directement)
 * qu'à l'intérieur d'une transaction plus large (achat, vente...), pour
 * garantir l'atomicité avec le reste de l'opération.
 */
export async function recordStockMovement(
  params: {
    storeId: string;
    productVariantId: string;
    warehouseId: string;
    type: StockMovementType;
    /** Positif pour une entrée, négatif pour une sortie. */
    quantityChange: number;
    userId?: string | null;
    reason?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    /**
     * Date de péremption de l'entrée de stock — uniquement pertinente pour
     * `quantityChange > 0`. Crée un lot séparé, tracé par sa propre date.
     * Une entrée sans date renseignée n'a pas de lot, ce qui reste sans
     * conséquence sur le total agrégé (`Inventory`), seulement sur le suivi
     * fin par lot.
     */
    expiryDate?: Date | null;
    /**
     * Autorise le stock à passer négatif (voir `Store.allowNegativeStock`).
     * L'appelant transmet le réglage de la boutique — jamais lu ici, pour
     * éviter une requête supplémentaire à chaque mouvement. Ne relâche que la
     * condition de suffisance : l'écriture reste atomique dans les deux cas,
     * deux caisses simultanées ne peuvent toujours pas désynchroniser le
     * stock.
     */
    allowNegativeStock?: boolean;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  // Écriture atomique et conditionnelle : deux mouvements simultanés sur la
  // même ligne (deux caisses, deux onglets) ne doivent jamais tous les deux
  // réussir sur la base d'une même lecture périmée — sans quoi le stock
  // affiché diverge silencieusement du stock réel (vente en double du
  // dernier article). Le `where` combine l'identifiant unique et, pour une
  // sortie, la condition de suffisance : Prisma échoue avec P2025 si la
  // ligne n'existe pas OU si la condition n'est plus vraie au moment de
  // l'écriture — jamais un calcul fait sur une lecture antérieure.
  const key = {
    productVariantId: params.productVariantId,
    warehouseId: params.warehouseId,
  };

  const enforceSufficientStock = params.quantityChange < 0 && !params.allowNegativeStock;

  let quantityAfter: number;
  try {
    const updated = await tx.inventory.update({
      where: {
        productVariantId_warehouseId: key,
        ...(enforceSufficientStock ? { quantity: { gte: -params.quantityChange } } : {}),
      },
      data: { quantity: { increment: params.quantityChange } },
    });
    quantityAfter = toQty(updated.quantity);
  } catch (error) {
    const isMissingRecord =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
    if (!isMissingRecord) throw error;

    if (enforceSufficientStock) {
      // Sortie sur une ligne absente ou insuffisante — dans les deux cas,
      // le stock disponible ne couvre pas la demande. Lecture ponctuelle,
      // seulement pour un message d'erreur informatif (jamais utilisée pour
      // décider si l'opération doit réussir, décidé plus haut de façon
      // atomique).
      const current = await tx.inventory.findUnique({ where: { productVariantId_warehouseId: key } });
      const available = current ? toQty(current.quantity) : 0;
      throw new Error(
        `Stock insuffisant : ${available} en stock, ${Math.abs(params.quantityChange)} demandés.`,
      );
    }

    // Aucune ligne n'existe encore pour ce couple variante/entrepôt (premier
    // mouvement) : on la crée. En vente à découvert, cette première ligne peut
    // naître négative — c'est le comportement attendu quand le commerçant a
    // choisi de vendre avant d'avoir saisi son stock. Si une autre création
    // concurrente l'a créée entre-temps (P2002), l'incrément se rejoue en
    // toute sécurité via le même chemin atomique.
    try {
      const created = await tx.inventory.create({
        data: { ...key, quantity: params.quantityChange },
      });
      quantityAfter = toQty(created.quantity);
    } catch (createError) {
      const isDuplicate =
        createError instanceof Prisma.PrismaClientKnownRequestError && createError.code === 'P2002';
      if (!isDuplicate) throw createError;

      const updated = await tx.inventory.update({
        where: { productVariantId_warehouseId: key },
        data: { quantity: { increment: params.quantityChange } },
      });
      quantityAfter = toQty(updated.quantity);
    }
  }

  const quantityBefore = quantityAfter - params.quantityChange;

  await tx.inventoryMovement.create({
    data: {
      storeId: params.storeId,
      productVariantId: params.productVariantId,
      warehouseId: params.warehouseId,
      type: params.type,
      quantityChange: params.quantityChange,
      quantityBefore,
      quantityAfter,
      userId: params.userId ?? null,
      reason: params.reason ?? null,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
    },
  });

  if (params.quantityChange > 0 && params.expiryDate) {
    await tx.stockBatch.create({
      data: {
        storeId: params.storeId,
        productVariantId: params.productVariantId,
        warehouseId: params.warehouseId,
        quantity: params.quantityChange,
        remainingQuantity: params.quantityChange,
        expiryDate: params.expiryDate,
      },
    });
  } else if (params.quantityChange < 0) {
    await depleteBatchesFifo(
      tx,
      params.storeId,
      params.productVariantId,
      params.warehouseId,
      -params.quantityChange,
    );
  }

  // Alerte uniquement au *franchissement* du seuil (une sortie de stock qui
  // fait passer sous le seuil), jamais à chaque mouvement suivant : sans
  // quoi chaque vente d'un produit déjà bas noierait l'équipe d'alertes
  // redondantes.
  if (params.quantityChange < 0) {
    const variant = await tx.storeProductVariant.findUnique({
      where: { id: params.productVariantId },
      select: { product: { select: { name: true, minStockAlert: true } } },
    });
    if (variant) {
      const threshold = toQty(variant.product.minStockAlert);
      if (quantityBefore > 0 && quantityAfter <= 0) {
        await createNotification({
          storeId: params.storeId,
          type: 'OUT_OF_STOCK',
          title: `Rupture de stock : ${variant.product.name}`,
          body: `${variant.product.name} n'a plus de stock disponible.`,
          href: '/boutique/dashboard/produits',
        });
      } else if (threshold > 0 && quantityBefore > threshold && quantityAfter <= threshold) {
        await createNotification({
          storeId: params.storeId,
          type: 'LOW_STOCK',
          title: `Stock faible : ${variant.product.name}`,
          body: `${variant.product.name} : ${quantityAfter} restant${quantityAfter > 1 ? 's' : ''}, sous le seuil d'alerte (${threshold}).`,
          href: '/boutique/dashboard/produits',
        });
        await triggerWebhooks(params.storeId, 'LOW_STOCK', {
          productVariantId: params.productVariantId,
          productName: variant.product.name,
          quantity: quantityAfter,
          threshold,
        });
      }
    }
  }

  return { quantityBefore, quantityAfter };
}

/**
 * Épuise les lots existants en priorité sur la date de péremption la plus
 * proche (FIFO), jusqu'à couvrir la quantité sortante — ou jusqu'à épuiser
 * les lots disponibles si une partie du stock n'a jamais été rattachée à un
 * lot (reçue avant l'introduction de cette fonctionnalité, ou sans date
 * renseignée). Ce n'est pas un système de coût par lot : seule la quantité
 * restante et la date sont suivies.
 */
async function depleteBatchesFifo(
  tx: Prisma.TransactionClient | typeof prisma,
  storeId: string,
  productVariantId: string,
  warehouseId: string,
  quantityToDeplete: number,
) {
  const batches = await tx.stockBatch.findMany({
    where: { storeId, productVariantId, warehouseId, remainingQuantity: { gt: 0 } },
    orderBy: { expiryDate: 'asc' },
  });

  let remaining = quantityToDeplete;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const batchRemaining = toQty(batch.remainingQuantity);
    const take = Math.min(batchRemaining, remaining);
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { remainingQuantity: batchRemaining - take },
    });
    remaining -= take;
  }
}
