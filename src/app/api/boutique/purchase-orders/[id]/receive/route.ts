import { z } from 'zod';

import { route, ok, parseOrThrow, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

const receiveSchema = z.object({
  /** Date de péremption commune au lot reçu, facultative (denrées, cosmétiques...). */
  expiryDate: z.coerce.date().optional(),
});

/**
 * Réception d'une commande d'achat — première version : réception complète
 * uniquement (pas de réception partielle). Augmente le stock de chaque
 * ligne, met à jour le coût d'achat courant de la variante (la marge
 * affichée doit refléter le dernier prix payé) et incrémente la dette
 * envers le fournisseur — jamais modifiée à la main.
 */
export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('purchases:manage');
  const { id } = await params;
  const input = parseOrThrow(receiveSchema, await readJson(request).catch(() => ({})));

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id, storeId: context.store.id },
    include: { items: true },
  });
  if (!purchaseOrder) throw new NotFoundError('Commande introuvable.');
  if (purchaseOrder.status === 'RECEIVED') {
    throw new ValidationError('Cette commande a déjà été réceptionnée.');
  }
  if (purchaseOrder.status === 'CANCELLED') {
    throw new ValidationError('Cette commande a été annulée.');
  }

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  const totalCost = purchaseOrder.items.reduce(
    (sum, item) => sum + item.unitCost * toQty(item.quantityOrdered),
    0,
  ) + purchaseOrder.extraFees;

  await prisma.$transaction(async (tx) => {
    for (const item of purchaseOrder.items) {
      const quantityOrdered = toQty(item.quantityOrdered);

      await recordStockMovement(
        {
          storeId: context.store.id,
          productVariantId: item.productVariantId,
          warehouseId: defaultWarehouse.id,
          type: 'PURCHASE',
          quantityChange: quantityOrdered,
          userId: context.user.id,
          referenceType: 'purchase_order',
          referenceId: purchaseOrder.id,
          expiryDate: input.expiryDate ?? null,
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
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference, totalCost },
  });

  return ok({ success: true });
});
