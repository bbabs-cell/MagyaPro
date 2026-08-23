import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { storeReturnSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const GET = route(async () => {
  const { store } = await requireStore('sales:view');

  const returns = await prisma.storeReturn.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      sale: { select: { number: true } },
      items: { select: { productVariantId: true, quantity: true, unitPrice: true } },
    },
  });

  return ok({ returns });
});

/**
 * Enregistrement d'un retour. Les prix ne sont jamais pris depuis la
 * requête : chaque ligne reprend le prix unitaire figé sur la vente
 * d'origine (`SaleItem.unitPrice`), jamais celui, potentiellement modifié
 * depuis, du produit. La quantité déjà retournée est déduite de la
 * quantité vendue pour empêcher un retour supérieur à ce qui a été acheté,
 * y compris cumulé sur plusieurs retours partiels.
 *
 * Traité en une seule étape (pas de workflow d'approbation séparé) : le
 * stock est ré-approvisionné et, pour une vente à crédit, le solde du
 * client réduit d'autant — sans quoi il resterait à devoir pour des
 * articles qu'il a rendus.
 *
 * Non géré dans cette version : l'impact sur la caisse (une remise en
 * espèces n'est pas tracée comme mouvement de caisse) — limitation connue,
 * pas simulée.
 */
export const POST = route(async (request) => {
  const context = await requireStore('sales:refund');

  const input = parseOrThrow(storeReturnSchema, await readJson(request));

  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, storeId: context.store.id },
    include: {
      items: true,
      returns: { include: { items: true } },
      customer: true,
    },
  });
  if (!sale) throw new NotFoundError('Vente introuvable.');

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
  });
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
        storeId: context.store.id,
        saleId: sale.id,
        status: 'COMPLETED',
        resolution: input.resolution,
        reason: input.reason ?? null,
        userId: context.user.id,
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
          storeId: context.store.id,
          productVariantId: line.productVariantId,
          warehouseId: defaultWarehouse.id,
          type: 'RETURN',
          quantityChange: line.quantity,
          userId: context.user.id,
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
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_return',
    targetId: created.id,
    metadata: { saleId: sale.id, resolution: input.resolution, refundTotal },
  });

  return ok({ return: created }, 201);
});
