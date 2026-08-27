import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { publicStoreOrderSchema } from '@/lib/validation';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { toQty } from '@/lib/boutique/quantity';
import { parseVariantAxes, variantLabel } from '@/lib/boutique/variants';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { notifyCustomerOrderEvent } from '@/lib/boutique/order-notifications';
import { triggerWebhooks } from '@/lib/boutique/webhooks';

/**
 * Création d'une commande depuis le site public d'une boutique — miroir
 * simplifié de `/api/public/commande` (Restaurant) : retrait en boutique
 * uniquement, aucun paiement en ligne, aucune réservation de stock (une
 * commande n'est vérifiée que par rapport au stock disponible au moment de
 * la création — une limitation documentée, pas un oubli : la boutique
 * confirme ou refuse la commande en connaissance de cause).
 *
 * Aucun montant n'est accepté du client : le corps ne contient que des
 * identifiants de produits et des quantités, les prix sont relus depuis la
 * base.
 */
export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  const input = parseOrThrow(publicStoreOrderSchema, await readJson(request));

  await hit(`store-checkout:ip:${ip}`, RATE_LIMITS.checkout);
  await hit(`store-checkout:phone:${input.customerPhone}`, RATE_LIMITS.checkout);

  const store = await prisma.store.findFirst({
    where: { id: input.storeId, status: 'ACTIVE' },
    select: { id: true, name: true, currency: true },
  });
  if (!store) throw new NotFoundError('Boutique introuvable.');

  const productIds = input.items.map((item) => item.productId);
  const products = await prisma.storeProduct.findMany({
    where: { id: { in: productIds }, storeId: store.id, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      variantAxes: true,
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          price: true,
          salePrice: true,
          attributes: true,
          inventory: { select: { quantity: true } },
        },
      },
    },
  });

  if (products.length !== new Set(productIds).size) {
    throw new NotFoundError('Un ou plusieurs produits sont introuvables.');
  }

  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const lines = input.items.map((item) => {
    const product = productById.get(item.productId)!;

    // La déclinaison demandée est cherchée parmi celles de CE produit : un
    // identifiant venu du navigateur ne peut donc pas désigner l'article
    // d'une autre fiche, ni d'une autre boutique. Sans déclinaison précisée
    // (panier ancien, produit sans taille), la première active fait foi.
    const variant = item.variantId
      ? product.variants.find((candidate) => candidate.id === item.variantId)
      : product.variants[0];

    if (!variant) {
      throw new ValidationError(`« ${product.name} » n'est plus disponible.`, {
        productId: 'Produit indisponible.',
      });
    }

    const axes = parseVariantAxes(product.variantAxes);
    const label = variantLabel((variant.attributes ?? {}) as Record<string, string>, axes);
    const displayName = label ? `${product.name} — ${label}` : product.name;

    const stock = variant.inventory.reduce((sum, inv) => sum + toQty(inv.quantity), 0);
    if (item.quantity > stock) {
      throw new ValidationError(
        `Stock insuffisant pour « ${displayName} » (${stock} disponible${stock > 1 ? 's' : ''}).`,
        { productId: 'Quantité indisponible.' },
      );
    }

    const unitPrice = variant.salePrice ?? variant.price;
    const lineTotal = Math.round(unitPrice * item.quantity);
    subtotal += lineTotal;

    return {
      productVariantId: variant.id,
      // Nom figé à la commande, déclinaison comprise : la boutique doit
      // savoir quelle taille préparer, même si la fiche change ensuite.
      productName: displayName,
      quantity: item.quantity,
      unitPrice,
      total: lineTotal,
    };
  });

  const order = await prisma.$transaction(async (tx) => {
    const updatedStore = await tx.store.update({
      where: { id: store.id },
      data: { orderCounter: { increment: 1 } },
      select: { orderCounter: true },
    });

    return tx.storeOrder.create({
      data: {
        storeId: store.id,
        number: updatedStore.orderCounter,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        notes: input.notes ?? null,
        subtotal,
        total: subtotal,
        currency: store.currency,
        items: { create: lines },
      },
      include: { items: true },
    });
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_ORDER_CREATED,
    storeId: store.id,
    targetType: 'store_order',
    targetId: order.id,
    ip,
    metadata: { number: order.number, total: order.total },
  });

  await createNotification({
    storeId: store.id,
    type: 'ORDER_CREATED',
    title: `Nouvelle commande n°${order.number}`,
    body: `${input.customerName} a passé une commande de ${lines.length} article${lines.length > 1 ? 's' : ''} à retirer en boutique.`,
    href: '/boutique/dashboard/commandes',
    metadata: { orderId: order.id, number: order.number },
  });

  await notifyCustomerOrderEvent('CREATED', order, store.name);

  await triggerWebhooks(store.id, 'ORDER_CREATED', {
    id: order.id,
    number: order.number,
    total: order.total,
  });

  return ok({ order }, 201);
});
