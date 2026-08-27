import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { toQty } from '@/lib/boutique/quantity';
import { resolveVariantUnits, toBaseQuantity } from '@/lib/boutique/units-engine';
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

  // Unités d'achat de chaque variante, relues depuis la fiche produit — le
  // client n'envoie qu'un identifiant, jamais un facteur.
  const unitsByVariant = new Map(
    await Promise.all(
      [...new Set(variantIds)].map(
        async (id) => [id, await resolveVariantUnits({ storeId, productVariantId: id })] as const,
      ),
    ),
  );

  const lines = input.items.map((item) => {
    const available = unitsByVariant.get(item.productVariantId)!;
    const unit = item.unitId
      ? available.find((candidate) => candidate.unitId === item.unitId)
      : available.find((candidate) => candidate.isBase);

    if (!unit) throw new ValidationError("Unité d'achat inconnue pour ce produit.");
    if (!unit.isPurchasable) {
      throw new ValidationError(`Ce produit ne s'achète pas en ${unit.label}.`);
    }

    return {
      productVariantId: item.productVariantId,
      // Commandé en cartons, enregistré en unités de base : la réception et
      // son verrou optimiste raisonnent dans la même unité que le stock.
      quantityOrdered: toBaseQuantity(item.quantity, unit.factor),
      unitId: unit.unitId,
      unitLabel: unit.label,
      unitFactor: unit.factor,
      unitCost: item.unitCost,
      discount: item.discount,
    };
  });

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
      items: { create: lines },
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
      const orderedQty = toQty(item.quantityOrdered);

      // `quantityReceived` doit être relu puis écrit de façon atomique et
      // conditionnelle : deux réceptions concurrentes de la même commande
      // (deux onglets) basées sur une lecture faite avant l'ouverture de la
      // transaction pourraient sinon dépasser `quantityOrdered` — chacune
      // clampant sur un `remaining` déjà périmé. La condition d'égalité
      // dans le `where` agit comme un verrou optimiste : si une autre
      // réception a déjà écrit entre la lecture et l'écriture, Prisma lève
      // P2025 et on relit puis retente sur l'état à jour, jusqu'à ce que la
      // ligne soit épuisée ou que l'écriture aboutisse.
      let quantity = 0;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const freshItem = await tx.purchaseOrderItem.findUniqueOrThrow({
          where: { id: line.purchaseOrderItemId },
        });
        const remaining = orderedQty - toQty(freshItem.quantityReceived);
        if (remaining <= 0) {
          quantity = 0;
          break;
        }
        quantity = Math.min(line.quantity, remaining);
        if (quantity <= 0) break;

        try {
          await tx.purchaseOrderItem.update({
            where: { id: freshItem.id, quantityReceived: freshItem.quantityReceived },
            data: { quantityReceived: { increment: quantity } },
          });
          break;
        } catch (error) {
          const isStale =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
          if (!isStale) throw error;
          quantity = 0; // une autre réception a gagné cette tentative — on relit au tour suivant
        }
      }
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
      // `unitCost` est le coût d'une unité d'ACHAT (un carton), tandis que
      // `quantity` est en unités de base. Le montant réellement dépensé est
      // donc le coût du carton multiplié par le nombre de cartons reçus.
      // Diviser d'abord `unitCost` par le facteur perdrait des francs à
      // l'arrondi (22 000 / 12 × 12 ≠ 22 000).
      const purchaseFactor = toQty(item.unitFactor) || 1;
      const incomingUnitCost = Math.max(0, item.unitCost - item.discount);
      const incomingValue = Math.round((quantity / purchaseFactor) * incomingUnitCost);
      const newCost =
        existingQty + quantity > 0
          ? Math.round((existingValue + incomingValue) / (existingQty + quantity))
          : Math.round(incomingUnitCost / purchaseFactor);

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

      // `quantityReceived` a déjà été incrémenté de façon atomique plus
      // haut, avant que le coût pondéré ne soit calculé sur sa base.

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
