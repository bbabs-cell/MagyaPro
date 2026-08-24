import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { z } from 'zod';
import type { storeReturnSchema } from '@/lib/validation';

/**
 * Retours sur vente — extrait de la route pour être testable directement,
 * même principe que `sales-service.ts`.
 *
 * Les prix ne sont jamais pris depuis la requête : chaque ligne reprend le
 * prix unitaire figé sur la vente d'origine (`SaleItem.unitPrice`), jamais
 * celui, potentiellement modifié depuis, du produit. La quantité déjà
 * retournée est déduite de la quantité vendue pour empêcher un retour
 * supérieur à ce qui a été acheté, y compris cumulé sur plusieurs retours
 * partiels.
 */
export async function createReturn(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  input: z.infer<typeof storeReturnSchema>;
}) {
  const { storeId, userId, userEmail, input } = params;

  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, storeId },
    include: {
      items: true,
      returns: { include: { items: true } },
      customer: true,
    },
  });
  if (!sale) throw new NotFoundError('Vente introuvable.');

  const defaultWarehouse = await prisma.warehouse.findFirst({ where: { storeId, isDefault: true } });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  const alreadyReturnedByVariant = new Map<string, number>();
  for (const previousReturn of sale.returns) {
    for (const item of previousReturn.items) {
      alreadyReturnedByVariant.set(
        item.productVariantId,
        (alreadyReturnedByVariant.get(item.productVariantId) ?? 0) + toQty(item.quantity),
      );
    }
  }

  let refundTotal = 0;
  const lines = input.items.map((requested) => {
    const saleItem = sale.items.find((i) => i.productVariantId === requested.productVariantId);
    if (!saleItem) {
      throw new ValidationError('Un article ne fait pas partie de cette vente.', {
        productVariantId: requested.productVariantId,
      });
    }
    const alreadyReturned = alreadyReturnedByVariant.get(requested.productVariantId) ?? 0;
    const remaining = toQty(saleItem.quantity) - alreadyReturned;
    if (requested.quantity > remaining) {
      throw new ValidationError(
        `Quantité demandée supérieure à ce qui peut encore être retourné (${remaining} restant${remaining > 1 ? 's' : ''}).`,
        { productVariantId: requested.productVariantId },
      );
    }
    refundTotal += saleItem.unitPrice * requested.quantity;
    return {
      productVariantId: requested.productVariantId,
      quantity: requested.quantity,
      unitPrice: saleItem.unitPrice,
    };
  });

  const totalSoldQuantity = sale.items.reduce((sum, i) => sum + toQty(i.quantity), 0);
  const totalReturnedAfter =
    [...alreadyReturnedByVariant.values()].reduce((sum, q) => sum + q, 0) +
    lines.reduce((sum, l) => sum + l.quantity, 0);
  const newSaleStatus = totalReturnedAfter >= totalSoldQuantity ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  const created = await prisma.$transaction(async (tx) => {
    const storeReturn = await tx.storeReturn.create({
      data: {
        storeId,
        saleId: sale.id,
        status: 'COMPLETED',
        resolution: input.resolution,
        reason: input.reason ?? null,
        userId,
        items: { create: lines },
      },
      include: { items: true },
    });

    await tx.sale.update({ where: { id: sale.id }, data: { status: newSaleStatus } });

    if (input.resolution === 'REFUND' && sale.customer && sale.creditAmount > 0) {
      const decrement = Math.min(refundTotal, sale.customer.creditBalance);
      if (decrement > 0) {
        await tx.storeCustomer.update({
          where: { id: sale.customer.id },
          data: { creditBalance: { decrement } },
        });
      }
    }

    for (const line of lines) {
      await recordStockMovement(
        {
          storeId,
          productVariantId: line.productVariantId,
          warehouseId: defaultWarehouse.id,
          type: 'RETURN',
          quantityChange: line.quantity,
          userId,
          referenceType: 'return',
          referenceId: storeReturn.id,
        },
        tx,
      );
    }

    return storeReturn;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_RETURN_CREATED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'store_return',
    targetId: created.id,
    metadata: { saleId: sale.id, resolution: input.resolution, refundTotal },
  });

  return created;
}
