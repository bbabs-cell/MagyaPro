import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { z } from 'zod';
import type { storePurchaseOrderSchema } from '@/lib/validation';

/**
 * Commandes d'achat — extrait des routes pour être testable directement,
 * même principe que `sales-service.ts`.
 */

/** Numéro de commande lisible, propre à chaque boutique. */
async function nextPurchaseOrderReference(storeId: string): Promise<string> {
  const count = await prisma.purchaseOrder.count({ where: { storeId } });
  return `PO-${String(count + 1).padStart(4, '0')}`;
}

export async function createPurchaseOrder(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  input: z.infer<typeof storePurchaseOrderSchema>;
}) {
  const { storeId, userId, userEmail, input } = params;

  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, storeId } });
  if (!supplier) throw new NotFoundError('Fournisseur introuvable.');

  const variantIds = input.items.map((item) => item.productVariantId);
  const variantCount = await prisma.storeProductVariant.count({
    where: { id: { in: variantIds }, product: { storeId } },
  });
  if (variantCount !== new Set(variantIds).size) {
    throw new NotFoundError('Un ou plusieurs produits sont introuvables.');
  }

  const reference = await nextPurchaseOrderReference(storeId);

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      storeId,
      supplierId: input.supplierId,
      reference,
      status: 'ORDERED',
      orderedAt: new Date(),
      note: input.note ?? null,
      items: {
        create: input.items.map((item) => ({
          productVariantId: item.productVariantId,
          quantityOrdered: item.quantity,
          unitCost: item.unitCost,
        })),
      },
    },
    include: { items: true, supplier: { select: { name: true } } },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PURCHASE_ORDER_CREATED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference },
  });

  return purchaseOrder;
}

/**
 * Réception d'une commande d'achat — première version : réception complète
 * uniquement (pas de réception partielle). Augmente le stock de chaque
 * ligne, met à jour le coût d'achat courant de la variante (la marge
 * affichée doit refléter le dernier prix payé) et incrémente la dette
 * envers le fournisseur — jamais modifiée à la main.
 */
export async function receivePurchaseOrder(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  purchaseOrderId: string;
  expiryDate?: Date;
}) {
  const { storeId, userId, userEmail, purchaseOrderId, expiryDate } = params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, storeId },
    include: { items: true },
  });
  if (!purchaseOrder) throw new NotFoundError('Commande introuvable.');
  if (purchaseOrder.status === 'RECEIVED') {
    throw new ValidationError('Cette commande a déjà été réceptionnée.');
  }
  if (purchaseOrder.status === 'CANCELLED') {
    throw new ValidationError('Cette commande a été annulée.');
  }

  const defaultWarehouse = await prisma.warehouse.findFirst({ where: { storeId, isDefault: true } });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  const totalCost =
    purchaseOrder.items.reduce((sum, item) => sum + item.unitCost * toQty(item.quantityOrdered), 0) +
    purchaseOrder.extraFees;

  await prisma.$transaction(async (tx) => {
    for (const item of purchaseOrder.items) {
      const quantityOrdered = toQty(item.quantityOrdered);

      await recordStockMovement(
        {
          storeId,
          productVariantId: item.productVariantId,
          warehouseId: defaultWarehouse.id,
          type: 'PURCHASE',
          quantityChange: quantityOrdered,
          userId,
          referenceType: 'purchase_order',
          referenceId: purchaseOrder.id,
          expiryDate: expiryDate ?? null,
        },
        tx,
      );

      await tx.storeProductVariant.update({
        where: { id: item.productVariantId },
        data: { cost: item.unitCost },
      });

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: quantityOrdered },
      });
    }

    await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
    });

    await tx.supplier.update({
      where: { id: purchaseOrder.supplierId },
      data: { debtBalance: { increment: totalCost } },
    });
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PURCHASE_ORDER_RECEIVED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference, totalCost },
  });

  return { totalCost };
}
