import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { storeSaleSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const GET = route(async () => {
  const { store } = await requireStore('sales:view');

  const sales = await prisma.sale.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: { select: { productName: true, quantity: true } },
      payments: { select: { method: true, amount: true } },
    },
  });

  return ok({ sales });
});

/**
 * Enregistrement d'une vente (caisse/POS).
 *
 * Les prix ne sont jamais pris depuis la requête : chaque ligne est
 * re-tarifée depuis `StoreProductVariant` au moment de la vente, comme pour
 * une commande Restaurant (`priceOrder`) — un client qui altérerait le prix
 * envoyé ne changerait rien au montant réellement facturé. Le stock est
 * vérifié et décrémenté dans la même transaction que la vente : jamais de
 * vente enregistrée sans mouvement de stock correspondant.
 */
export const POST = route(async (request) => {
  const context = await requireStore('pos:access');
  hit(`boutique-sales:${context.store.id}`, RATE_LIMITS.checkout);

  const input = parseOrThrow(storeSaleSchema, await readJson(request));

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  let customer = null;
  if (input.customerId) {
    customer = await prisma.storeCustomer.findFirst({
      where: { id: input.customerId, storeId: context.store.id },
    });
    if (!customer) throw new NotFoundError('Client introuvable.');
  }

  const variantIds = input.items.map((item) => item.productVariantId);
  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds }, product: { storeId: context.store.id } },
    include: { product: { select: { name: true } } },
  });

  if (variants.length !== new Set(variantIds).size) {
    throw new NotFoundError('Un ou plusieurs produits sont introuvables.');
  }

  const variantById = new Map(variants.map((v) => [v.id, v]));

  let subtotal = 0;
  const lines = input.items.map((item) => {
    const variant = variantById.get(item.productVariantId)!;
    const lineTotal = variant.price * item.quantity;
    subtotal += lineTotal;
    return {
      productVariantId: variant.id,
      productName: variant.product.name,
      variantLabel: variant.sku,
      quantity: item.quantity,
      unitPrice: variant.price,
      total: lineTotal,
    };
  });

  const discount = Math.min(input.discount, subtotal);
  const total = subtotal - discount;

  if (input.isCredit && customer) {
    const projectedBalance = customer.creditBalance + total;
    if (customer.creditLimit > 0 && projectedBalance > customer.creditLimit) {
      throw new ValidationError('Cette vente dépasserait la limite de crédit du client.', {
        customerId: `Limite : ${customer.creditLimit}, solde actuel : ${customer.creditBalance}.`,
      });
    }
  }

  const sale = await prisma.$transaction(async (tx) => {
    const store = await tx.store.update({
      where: { id: context.store.id },
      data: { saleCounter: { increment: 1 } },
      select: { saleCounter: true },
    });

    const created = await tx.sale.create({
      data: {
        storeId: context.store.id,
        number: store.saleCounter,
        userId: context.user.id,
        customerId: customer?.id ?? null,
        subtotal,
        discount,
        total,
        creditAmount: input.isCredit ? total : 0,
        ...(input.isCredit
          ? {}
          : { payments: { create: { method: input.paymentMethod!, amount: total } } }),
        items: { create: lines },
      },
      include: { items: true, payments: true },
    });

    if (customer) {
      await tx.storeCustomer.update({
        where: { id: customer.id },
        data: {
          salesCount: { increment: 1 },
          totalSpent: { increment: total },
          lastSaleAt: new Date(),
          ...(input.isCredit ? { creditBalance: { increment: total } } : {}),
        },
      });
    }

    // Décrémente le stock ligne par ligne, référencé à la vente qui vient
    // d'être créée. `recordStockMovement` lève une erreur si la quantité
    // demandée dépasse le stock disponible, ce qui annule toute la
    // transaction — aucune vente partielle possible.
    for (const item of input.items) {
      await recordStockMovement(
        {
          storeId: context.store.id,
          productVariantId: item.productVariantId,
          warehouseId: defaultWarehouse.id,
          type: 'SALE',
          quantityChange: -item.quantity,
          userId: context.user.id,
          referenceType: 'sale',
          referenceId: created.id,
        },
        tx,
      );
    }

    return created;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SALE_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'sale',
    targetId: sale.id,
    metadata: { total: sale.total, itemCount: sale.items.length },
  });

  return ok({ sale }, 201);
});
