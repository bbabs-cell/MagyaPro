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

  return { quantityBefore, quantityAfter };
}
