import type { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { priceOrder, type CartInput } from '@/lib/orders/pricing';
import { notifyNewOrder, notifyOrderStatusChanged } from '@/lib/notifications';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ORDER_STATUS_LABELS, canTransition } from '@/lib/orders/status';

// Les transitions et libellés vivent dans un module pur, partagé avec
// l'interface : le dashboard ne peut pas proposer une transition que le
// serveur refuserait.
export {
  ORDER_TRANSITIONS,
  ORDER_STATUS_LABELS,
  canTransition,
} from '@/lib/orders/status';

export type CreateOrderInput = {
  restaurantId: string;
  items: CartInput[];
  fulfillmentType: 'DELIVERY' | 'PICKUP';
  deliveryZoneId?: string | null;
  promoCode?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress?: string | null;
  instructions?: string | null;
  paymentProvider: string;
  ip?: string | null;
};

/**
 * Crée une commande.
 *
 * Tout se déroule dans une transaction unique : tarification, numérotation,
 * fiche client, lignes de commande, compteur de promotion. Un plantage en
 * cours de route ne laisse ni commande orpheline ni numéro consommé.
 */
export async function createOrder(input: CreateOrderInput) {
  if (input.fulfillmentType === 'DELIVERY' && !input.deliveryAddress) {
    throw new ValidationError('Une adresse de livraison est nécessaire.', {
      deliveryAddress: 'Indiquez votre adresse de livraison.',
    });
  }

  const order = await prisma.$transaction(async (tx) => {
    // 1. Recalcul intégral des montants à partir de la base.
    const priced = await priceOrder(tx, {
      restaurantId: input.restaurantId,
      items: input.items,
      fulfillmentType: input.fulfillmentType,
      deliveryZoneId: input.deliveryZoneId,
      promoCode: input.promoCode,
    });

    // 2. Numéro séquentiel. L'incrément atomique en base évite que deux
    //    commandes simultanées reçoivent le même numéro.
    const restaurant = await tx.restaurant.update({
      where: { id: input.restaurantId },
      data: { orderCounter: { increment: 1 } },
      select: { orderCounter: true },
    });

    // 3. Fiche client, identifiée par le téléphone au sein du restaurant.
    //    Le portefeuille client est propre à chaque tenant : le même numéro
    //    chez deux restaurants donne deux fiches distinctes.
    const customer = await tx.customer.upsert({
      where: {
        restaurantId_phone: {
          restaurantId: input.restaurantId,
          phone: input.customerPhone,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        name: input.customerName,
        phone: input.customerPhone,
        email: input.customerEmail ?? null,
        ordersCount: 1,
        totalSpent: priced.total,
        lastOrderAt: new Date(),
      },
      update: {
        name: input.customerName,
        email: input.customerEmail ?? undefined,
        ordersCount: { increment: 1 },
        totalSpent: { increment: priced.total },
        lastOrderAt: new Date(),
      },
    });

    // 4. La commande et ses lignes, avec les instantanés de noms et de prix.
    const created = await tx.order.create({
      data: {
        restaurantId: input.restaurantId,
        customerId: customer.id,
        number: restaurant.orderCounter,
        fulfillmentType: input.fulfillmentType,
        paymentProvider: input.paymentProvider,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        instructions: input.instructions ?? null,
        subtotal: priced.subtotal,
        discount: priced.discount,
        deliveryFee: priced.deliveryFee,
        total: priced.total,
        currency: priced.currency,
        deliveryZoneId: priced.deliveryZoneId,
        promotionId: priced.promotionId,
        promoCode: priced.promoCode,
        items: {
          create: priced.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            options: item.options as never,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
        },
        events: { create: { toStatus: 'NEW' } },
      },
      include: { items: true },
    });

    // 5. Consommation du code promo, dans la même transaction pour que la
    //    limite d'utilisation ne puisse pas être dépassée par deux commandes
    //    concurrentes.
    if (priced.promotionId) {
      await tx.promotion.update({
        where: { id: priced.promotionId },
        data: { usedCount: { increment: 1 } },
      });
    }

    return created;
  });

  // Effets de bord hors transaction : leur échec ne doit pas annuler une
  // commande déjà payée par le client.
  await notifyNewOrder(order.restaurantId, order.id, order.number, order.total, order.currency);
  await recordAudit({
    action: AUDIT_ACTIONS.ORDER_CREATED,
    restaurantId: order.restaurantId,
    targetType: 'order',
    targetId: order.id,
    ip: input.ip,
    metadata: { number: order.number, total: order.total, provider: input.paymentProvider },
  });

  return order;
}

/**
 * Change le statut d'une commande.
 *
 * `restaurantId` est un paramètre obligatoire et fait partie de la clause
 * `where` : une commande d'un autre restaurant est introuvable, pas
 * « interdite ».
 */
export async function updateOrderStatus(params: {
  restaurantId: string;
  orderId: string;
  status: OrderStatus;
  userId?: string | null;
  actorEmail?: string | null;
  note?: string | null;
  ip?: string | null;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    select: { id: true, status: true, number: true },
  });
  if (!order) throw new NotFoundError('Commande introuvable.');

  if (order.status === params.status) return order;

  if (!canTransition(order.status, params.status)) {
    throw new ConflictError(
      `Une commande « ${ORDER_STATUS_LABELS[order.status]} » ne peut pas passer à « ${ORDER_STATUS_LABELS[params.status]} ».`,
    );
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: order.id },
      data: {
        status: params.status,
        statusUpdatedAt: now,
        completedAt: params.status === 'COMPLETED' ? now : undefined,
        cancelledAt: params.status === 'CANCELLED' ? now : undefined,
        cancelReason:
          params.status === 'CANCELLED' ? (params.note ?? null) : undefined,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: params.status,
        byUserId: params.userId ?? null,
        note: params.note ?? null,
      },
    });

    // Une commande annulée ne doit plus compter dans le chiffre d'affaires du
    // client ni dans son nombre de commandes.
    if (params.status === 'CANCELLED') {
      await tx.customer.update({
        where: { id: result.customerId },
        data: {
          ordersCount: { decrement: 1 },
          totalSpent: { decrement: result.total },
        },
      });
    }

    return result;
  });

  await notifyOrderStatusChanged(
    updated.restaurantId,
    updated.id,
    updated.number,
    params.status,
  );

  await recordAudit({
    action:
      params.status === 'CANCELLED'
        ? AUDIT_ACTIONS.ORDER_CANCELLED
        : AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
    actorUserId: params.userId,
    actorEmail: params.actorEmail,
    restaurantId: params.restaurantId,
    targetType: 'order',
    targetId: order.id,
    ip: params.ip,
    metadata: { from: order.status, to: params.status, number: order.number },
  });

  return updated;
}
