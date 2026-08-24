import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { z } from 'zod';
import type {
  storePurchaseOrderReceiveSchema,
  storePurchaseOrderSchema,
  storeSupplierPaymentSchema,
} from '@/lib/validation';

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
  const status = input.confirm ? 'ORDERED' : 'DRAFT';

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      storeId,
      supplierId: input.supplierId,
      reference,
      status,
      extraFees: input.extraFees,
      expectedAt: input.expectedAt ?? null,
      orderedAt: input.confirm ? new Date() : null,
      note: input.note ?? null,
      items: {
        create: input.items.map((item) => ({
          productVariantId: item.productVariantId,
          quantityOrdered: item.quantity,
          unitCost: item.unitCost,
          discount: item.discount,
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
    metadata: { reference: purchaseOrder.reference, status },
  });

  return purchaseOrder;
}

/** Confirme un brouillon — passe de DRAFT à ORDERED, rien d'autre ne change. */
export async function confirmPurchaseOrder(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  purchaseOrderId: string;
}) {
  const { storeId, userId, userEmail, purchaseOrderId } = params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, storeId } });
  if (!purchaseOrder) throw new NotFoundError('Commande introuvable.');
  if (purchaseOrder.status !== 'DRAFT') {
    throw new ValidationError('Seul un brouillon peut être confirmé.');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: purchaseOrder.id },
    data: { status: 'ORDERED', orderedAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PURCHASE_ORDER_CONFIRMED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference },
  });

  return updated;
}

/**
 * Annule une commande — seulement possible tant qu'aucune ligne n'a été
 * reçue (DRAFT ou ORDERED) : au-delà, du stock et une dette fournisseur
 * réels sont déjà engagés, une annulation silencieuse les laisserait
 * incohérents.
 */
export async function cancelPurchaseOrder(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  purchaseOrderId: string;
}) {
  const { storeId, userId, userEmail, purchaseOrderId } = params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, storeId },
    include: { items: true },
  });
  if (!purchaseOrder) throw new NotFoundError('Commande introuvable.');
  if (purchaseOrder.status !== 'DRAFT' && purchaseOrder.status !== 'ORDERED') {
    throw new ValidationError(
      'Cette commande ne peut plus être annulée : une réception a déjà eu lieu, ou elle est déjà annulée.',
    );
  }
  const anyReceived = purchaseOrder.items.some((item) => toQty(item.quantityReceived) > 0);
  if (anyReceived) {
    throw new ValidationError('Cette commande a déjà des lignes reçues, elle ne peut plus être annulée.');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: purchaseOrder.id },
    data: { status: 'CANCELLED' },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PURCHASE_ORDER_CANCELLED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference },
  });

  return updated;
}

/**
 * Réception d'une commande d'achat — totale ou partielle, répartie sur
 * plusieurs passages si besoin. Chaque ligne reçue augmente le stock de
 * l'entrepôt choisi, pondère le coût d'achat courant de la variante (moyenne
 * pondérée par la quantité déjà en stock, plutôt qu'un écrasement brutal du
 * prix) et incrémente la dette envers le fournisseur du montant réellement
 * reçu — jamais du total de la commande d'un coup, pour que la dette reflète
 * ce qui est réellement arrivé.
 */
export async function receivePurchaseOrder(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  purchaseOrderId: string;
  input: z.infer<typeof storePurchaseOrderReceiveSchema>;
}) {
  const { storeId, userId, userEmail, purchaseOrderId, input } = params;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, storeId },
    include: { items: true },
  });
  if (!purchaseOrder) throw new NotFoundError('Commande introuvable.');
  if (purchaseOrder.status === 'RECEIVED') {
    throw new ValidationError('Cette commande a déjà été intégralement réceptionnée.');
  }
  if (purchaseOrder.status === 'CANCELLED') {
    throw new ValidationError('Cette commande a été annulée.');
  }
  if (purchaseOrder.status === 'DRAFT') {
    throw new ValidationError('Confirmez la commande avant de la réceptionner.');
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { id: input.warehouseId, storeId } });
  if (!warehouse) throw new NotFoundError('Entrepôt introuvable.');

  const itemById = new Map(purchaseOrder.items.map((item) => [item.id, item]));
  for (const line of input.items) {
    if (!itemById.has(line.purchaseOrderItemId)) {
      throw new NotFoundError('Une ligne de commande est introuvable.');
    }
  }

  let receivedCost = 0;

  await prisma.$transaction(async (tx) => {
    for (const line of input.items) {
      const item = itemById.get(line.purchaseOrderItemId)!;
      const remaining = toQty(item.quantityOrdered) - toQty(item.quantityReceived);
      if (remaining <= 0) continue;
      // Ne jamais recevoir plus que ce qu'il reste à recevoir sur cette
      // ligne, même si la quantité saisie est plus élevée — un écart de
      // réception se corrige en ajustant la commande, pas en la dépassant
      // silencieusement.
      const quantity = Math.min(line.quantity, remaining);
      if (quantity <= 0) continue;

      // Moyenne pondérée : le coût de la variante reflète le mélange du
      // stock déjà en rayon et de ce qui vient d'arriver, pas seulement le
      // dernier prix payé — sans quoi une commande partielle à prix
      // différent écraserait injustement la marge de ce qui est déjà en
      // stock.
      const existingInventory = await tx.inventory.findMany({
        where: { productVariantId: item.productVariantId },
        select: { quantity: true },
      });
      const existingQty = existingInventory.reduce((sum, row) => sum + toQty(row.quantity), 0);
      const variant = await tx.storeProductVariant.findUniqueOrThrow({
        where: { id: item.productVariantId },
        select: { cost: true },
      });
      const existingValue = existingQty * variant.cost;
      const incomingUnitCost = Math.max(0, item.unitCost - item.discount);
      const incomingValue = quantity * incomingUnitCost;
      const newCost =
        existingQty + quantity > 0
          ? Math.round((existingValue + incomingValue) / (existingQty + quantity))
          : incomingUnitCost;

      await recordStockMovement(
        {
          storeId,
          productVariantId: item.productVariantId,
          warehouseId: warehouse.id,
          type: 'PURCHASE',
          quantityChange: quantity,
          userId,
          referenceType: 'purchase_order',
          referenceId: purchaseOrder.id,
          expiryDate: input.expiryDate ?? null,
        },
        tx,
      );

      await tx.storeProductVariant.update({
        where: { id: item.productVariantId },
        data: { cost: newCost },
      });

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: { increment: quantity } },
      });

      receivedCost += incomingValue;
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: purchaseOrder.id } });
    const fullyReceived = refreshedItems.every(
      (item) => toQty(item.quantityReceived) >= toQty(item.quantityOrdered),
    );

    await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: fullyReceived
        ? { status: 'RECEIVED', receivedAt: new Date() }
        : { status: 'PARTIALLY_RECEIVED' },
    });

    if (receivedCost > 0) {
      await tx.supplier.update({
        where: { id: purchaseOrder.supplierId },
        data: { debtBalance: { increment: receivedCost } },
      });
    }
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PURCHASE_ORDER_RECEIVED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'purchase_order',
    targetId: purchaseOrder.id,
    metadata: { reference: purchaseOrder.reference, receivedCost },
  });

  return { receivedCost };
}

/**
 * Paiement à un fournisseur — solde tout ou partie de sa dette, rattaché ou
 * non à une commande précise. Ne modifie jamais `debtBalance` autrement que
 * par cette écriture ou par la réception d'une commande.
 */
export async function addSupplierPayment(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  supplierId: string;
  input: z.infer<typeof storeSupplierPaymentSchema>;
}) {
  const { storeId, userId, userEmail, supplierId, input } = params;

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
  if (!supplier) throw new NotFoundError('Fournisseur introuvable.');

  if (input.purchaseOrderId) {
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, storeId, supplierId },
    });
    if (!purchaseOrder) throw new NotFoundError('Commande introuvable pour ce fournisseur.');
  }

  const [payment] = await prisma.$transaction([
    prisma.supplierPayment.create({
      data: {
        storeId,
        supplierId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        amount: input.amount,
        note: input.note ?? null,
      },
    }),
    prisma.supplier.update({
      where: { id: supplierId },
      data: { debtBalance: { decrement: input.amount } },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.SUPPLIER_PAYMENT_CREATED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'supplier_payment',
    targetId: payment.id,
    metadata: { supplierId, amount: input.amount, purchaseOrderId: input.purchaseOrderId ?? null },
  });

  return payment;
}
