import { prisma } from '@/lib/db';
import { recordStockMovement } from '@/lib/boutique/inventory';
import { resolveVariantUnits, toBaseQuantity } from '@/lib/boutique/units-engine';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { z } from 'zod';
import type { storeSaleSchema } from '@/lib/validation';

/**
 * Enregistrement d'une vente (caisse/POS) — extrait de la route pour être
 * testable directement (voir `tests/boutique-*.test.ts`), même principe que
 * `priceOrder`/`createOrder` côté Restaurant.
 *
 * Les prix ne sont jamais pris depuis la requête : chaque ligne est
 * re-tarifée depuis `StoreProductVariant` au moment de la vente — un client
 * qui altérerait le prix envoyé ne changerait rien au montant réellement
 * facturé. Le stock est vérifié et décrémenté dans la même transaction que
 * la vente : jamais de vente enregistrée sans mouvement de stock
 * correspondant.
 */
export async function createSale(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  input: z.infer<typeof storeSaleSchema>;
}) {
  const { storeId, userId, userEmail, input } = params;

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId, isDefault: true },
  });
  if (!defaultWarehouse) {
    throw new ValidationError("Aucun entrepôt par défaut n'est configuré pour cette boutique.");
  }

  let customer = null;
  if (input.customerId) {
    customer = await prisma.storeCustomer.findFirst({
      where: { id: input.customerId, storeId },
    });
    if (!customer) throw new NotFoundError('Client introuvable.');
  }

  const variantIds = input.items.map((item) => item.productVariantId);
  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds }, product: { storeId } },
    include: { product: { select: { name: true } } },
  });

  if (variants.length !== new Set(variantIds).size) {
    throw new NotFoundError('Un ou plusieurs produits sont introuvables.');
  }

  const variantById = new Map(variants.map((v) => [v.id, v]));

  // Unités vendables de chaque variante, relues depuis la fiche produit — le
  // client n'envoie qu'un identifiant d'unité, jamais un facteur ni un prix.
  const unitsByVariant = new Map(
    await Promise.all(
      [...new Set(variantIds)].map(
        async (id) => [id, await resolveVariantUnits({ storeId, productVariantId: id })] as const,
      ),
    ),
  );

  let subtotal = 0;
  const lines = input.items.map((item) => {
    const variant = variantById.get(item.productVariantId)!;
    const available = unitsByVariant.get(item.productVariantId)!;

    const unit = item.unitId
      ? available.find((candidate) => candidate.unitId === item.unitId)
      : available.find((candidate) => candidate.isBase);

    if (!unit) {
      throw new ValidationError(`Unité de vente inconnue pour ${variant.product.name}.`);
    }
    if (!unit.isSellable) {
      throw new ValidationError(
        `${variant.product.name} ne se vend pas en ${unit.label}.`,
      );
    }
    if (unit.price === null) {
      throw new ValidationError(
        `Aucun prix de vente en ${unit.label} pour ${variant.product.name}.`,
      );
    }

    // La quantité part en base de données dans l'unité de base : c'est elle
    // qui sort du stock, et elle rend les volumes vendus comparables d'une
    // unité à l'autre dans les rapports. Le facteur est figé sur la ligne —
    // corriger la taille d'un carton demain ne réécrira pas ce ticket.
    const baseQuantity = toBaseQuantity(item.quantity, unit.factor);
    const lineTotal = unit.price * item.quantity;
    subtotal += lineTotal;

    return {
      productVariantId: variant.id,
      productName: variant.product.name,
      variantLabel: unit.isBase ? variant.sku : `${unit.label} de ${unit.factor}`,
      saleUnit: unit.factor > 1 ? ('PACK' as const) : ('UNIT' as const),
      quantity: baseQuantity,
      unitId: unit.unitId,
      unitLabel: unit.label,
      unitFactor: unit.factor,
      unitPrice: unit.price,
      total: lineTotal,
    };
  });

  let promotion = null;
  let promoDiscount = 0;
  if (input.promoCode) {
    promotion = await prisma.storePromotion.findUnique({
      where: { storeId_code: { storeId, code: input.promoCode.toUpperCase() } },
    });
    if (!promotion || !promotion.isActive) {
      throw new ValidationError('Code promo invalide ou inactif.', { promoCode: 'Introuvable.' });
    }
    const now = new Date();
    if (promotion.startsAt && now < promotion.startsAt) {
      throw new ValidationError("Ce code promo n'est pas encore actif.", { promoCode: ' ' });
    }
    if (promotion.endsAt && now > promotion.endsAt) {
      throw new ValidationError('Ce code promo a expiré.', { promoCode: ' ' });
    }
    if (promotion.maxRedemptions !== null && promotion.usedCount >= promotion.maxRedemptions) {
      throw new ValidationError("Ce code promo a atteint sa limite d'utilisation.", { promoCode: ' ' });
    }
    if (subtotal < promotion.minCartAmount) {
      throw new ValidationError(
        `Panier minimum de ${promotion.minCartAmount} requis pour ce code.`,
        { promoCode: ' ' },
      );
    }
    promoDiscount =
      promotion.type === 'PERCENT'
        ? Math.round((subtotal * promotion.value) / 100)
        : Math.min(promotion.value, subtotal);
  }

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { taxEnabled: true, taxRate: true, allowNegativeStock: true },
  });

  const discount = Math.min(input.discount + promoDiscount, subtotal);
  const taxableAmount = subtotal - discount;
  const taxAmount = store.taxEnabled ? Math.round((taxableAmount * store.taxRate) / 1000) : 0;
  const total = taxableAmount + taxAmount;

  const paymentsTotal = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paymentsTotal > total) {
    throw new ValidationError('Le total des paiements dépasse le montant de la vente.', {
      payments: `Total à régler : ${total}.`,
    });
  }
  // Le reste, non couvert par un paiement, est mis à crédit sur le client.
  const creditAmount = total - paymentsTotal;
  if (creditAmount > 0 && !customer) {
    throw new ValidationError('Choisissez un client pour la part à crédit.', {
      customerId: 'Requis quand les paiements ne couvrent pas le total.',
    });
  }

  // Rattache la vente à la session de caisse en cours, si une est ouverte —
  // c'est ce qui permet à la fermeture de caisse de retrouver les ventes en
  // espèces de la journée. Une vente reste possible sans session ouverte.
  const openSession = await prisma.cashSession.findFirst({
    where: { storeId, status: 'OPEN' },
    select: { id: true },
  });

  if (creditAmount > 0 && customer) {
    const projectedBalance = customer.creditBalance + creditAmount;
    if (customer.creditLimit > 0 && projectedBalance > customer.creditLimit) {
      throw new ValidationError('Cette vente dépasserait la limite de crédit du client.', {
        customerId: `Limite : ${customer.creditLimit}, solde actuel : ${customer.creditBalance}.`,
      });
    }
  }

  const sale = await prisma.$transaction(async (tx) => {
    const updatedStore = await tx.store.update({
      where: { id: storeId },
      data: { saleCounter: { increment: 1 } },
      select: { saleCounter: true },
    });

    const created = await tx.sale.create({
      data: {
        storeId,
        number: updatedStore.saleCounter,
        userId,
        customerId: customer?.id ?? null,
        cashSessionId: openSession?.id ?? null,
        promotionId: promotion?.id ?? null,
        subtotal,
        discount,
        taxAmount,
        total,
        creditAmount,
        payments: { create: input.payments },
        items: { create: lines },
      },
      include: { items: true, payments: true },
    });

    if (promotion) {
      await tx.storePromotion.update({
        where: { id: promotion.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    if (customer) {
      await tx.storeCustomer.update({
        where: { id: customer.id },
        data: {
          salesCount: { increment: 1 },
          totalSpent: { increment: total },
          lastSaleAt: new Date(),
          ...(creditAmount > 0 ? { creditBalance: { increment: creditAmount } } : {}),
        },
      });
    }

    // Décrémente le stock ligne par ligne, référencé à la vente qui vient
    // d'être créée. `recordStockMovement` lève une erreur si la quantité
    // demandée dépasse le stock disponible, ce qui annule toute la
    // transaction — aucune vente partielle possible.
    for (const line of lines) {
      await recordStockMovement(
        {
          storeId,
          productVariantId: line.productVariantId,
          warehouseId: defaultWarehouse.id,
          type: 'SALE',
          // `line.quantity` est déjà en unité de base (converti plus haut) :
          // le stock ne connaît que cette unité, jamais les cartons.
          quantityChange: -line.quantity,
          userId,
          referenceType: 'sale',
          referenceId: created.id,
          allowNegativeStock: store.allowNegativeStock,
        },
        tx,
      );
    }

    return created;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SALE_CREATED,
    actorUserId: userId,
    actorEmail: userEmail,
    storeId,
    targetType: 'sale',
    targetId: sale.id,
    metadata: { total: sale.total, itemCount: sale.items.length },
  });

  return sale;
}
