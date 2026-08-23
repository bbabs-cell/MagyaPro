import { prisma } from '@/lib/db';
import type { Prisma, StockMovementType } from '@prisma/client';

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
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await tx.inventory.findUnique({
    where: {
      productVariantId_warehouseId: {
        productVariantId: params.productVariantId,
        warehouseId: params.warehouseId,
      },
    },
  });

  const quantityBefore = existing?.quantity ?? 0;
  const quantityAfter = quantityBefore + params.quantityChange;

  if (quantityAfter < 0) {
    throw new Error(
      `Stock insuffisant : ${quantityBefore} en stock, ${Math.abs(params.quantityChange)} demandés.`,
    );
  }

  await tx.inventory.upsert({
    where: {
      productVariantId_warehouseId: {
        productVariantId: params.productVariantId,
        warehouseId: params.warehouseId,
      },
    },
    create: {
      productVariantId: params.productVariantId,
      warehouseId: params.warehouseId,
      quantity: quantityAfter,
    },
    update: { quantity: quantityAfter },
  });

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
    const take = Math.min(batch.remainingQuantity, remaining);
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { remainingQuantity: batch.remainingQuantity - take },
    });
    remaining -= take;
  }
}
