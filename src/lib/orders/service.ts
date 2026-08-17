import type { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { priceOrder, type CartInput } from '@/lib/orders/pricing';
import { notifyNewOrder, notifyOrderStatusChanged } from '@/lib/notifications';
import { smsOrderConfirmation, smsOrderStatusChanged } from '@/lib/customer-notifications';
import { applyPaymentStatus } from '@/lib/payments/service';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ORDER_STATUS_LABELS, canTransition } from '@/lib/orders/status';
import { generateSixDigitCode } from '@/lib/codes';
import { grantLoyaltyRewards } from '@/lib/loyalty';

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
  fulfillmentType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  deliveryZoneId?: string | null;
  promoCode?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  instructions?: string | null;
  paymentProvider: string;
  tableId?: string | null;
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

  const result = await prisma.$transaction(async (tx) => {
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
      select: { orderCounter: true, name: true },
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
        tableId: input.tableId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        deliveryLat: input.deliveryLat ?? null,
        deliveryLng: input.deliveryLng ?? null,
        // Un code par livraison : demandé par le livreur à la remise, pour
        // s'assurer qu'il livre la bonne commande à la bonne personne.
        deliveryCode: input.fulfillmentType === 'DELIVERY' ? generateSixDigitCode() : null,
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

    // 6. Une commande passée depuis une table occupe cette table : ça
    //    reflète l'état réel de la salle sans action supplémentaire du
    //    personnel.
    if (input.tableId) {
      await tx.restaurantTable.updateMany({
        where: { id: input.tableId, restaurantId: input.restaurantId, status: 'FREE' },
        data: { status: 'OCCUPIED' },
      });
    }

    return { order: created, customerTotalSpent: customer.totalSpent, restaurantName: restaurant.name };
  });

  const { order, customerTotalSpent, restaurantName } = result;

  // Effets de bord hors transaction : leur échec ne doit pas annuler une
  // commande déjà payée par le client.
  await notifyNewOrder(order.restaurantId, order.id, order.number, order.total, order.currency);
  await smsOrderConfirmation({
    customerPhone: order.customerPhone,
    restaurantName,
    orderNumber: order.number,
    total: order.total,
    currency: order.currency,
  });
  await recordAudit({
    action: AUDIT_ACTIONS.ORDER_CREATED,
    restaurantId: order.restaurantId,
    targetType: 'order',
    targetId: order.id,
    ip: input.ip,
    metadata: { number: order.number, total: order.total, provider: input.paymentProvider },
  });

  // Une commande peut faire franchir un palier de fidélité au client : on
  // l'accorde avant de rendre la main, pour que la page de confirmation
  // puisse l'afficher immédiatement.
  await grantLoyaltyRewards({
    restaurantId: order.restaurantId,
    customerId: order.customerId,
    orderId: order.id,
    customerTotalSpent,
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
    select: {
      id: true,
      status: true,
      number: true,
      customerPhone: true,
      restaurant: { select: { name: true } },
    },
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
  await smsOrderStatusChanged({
    customerPhone: order.customerPhone,
    restaurantName: order.restaurant.name,
    orderNumber: updated.number,
    status: params.status,
  });

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

/**
 * Prise en charge d'une livraison par un livreur.
 *
 * L'affectation et le passage à `OUT_FOR_DELIVERY` se font en une seule
 * écriture conditionnelle (`updateMany` avec `courierId: null` dans le
 * `where`) : si deux livreurs tentent de prendre la même course en même
 * temps, un seul y parvient — le second reçoit une erreur claire plutôt
 * qu'une double affectation silencieuse.
 */
export async function claimDelivery(params: {
  restaurantId: string;
  orderId: string;
  courierId: string;
  courierEmail?: string | null;
}) {
  const claimed = await prisma.order.updateMany({
    where: {
      id: params.orderId,
      restaurantId: params.restaurantId,
      fulfillmentType: 'DELIVERY',
      status: 'READY',
      courierId: null,
    },
    data: { courierId: params.courierId, status: 'OUT_FOR_DELIVERY', statusUpdatedAt: new Date() },
  });

  if (claimed.count === 0) {
    const order = await prisma.order.findFirst({
      where: { id: params.orderId, restaurantId: params.restaurantId },
      select: { courierId: true, status: true },
    });
    if (!order) throw new NotFoundError('Livraison introuvable.');
    if (order.courierId) throw new ConflictError('Cette livraison est déjà prise en charge.');
    throw new ConflictError("Cette commande n'est pas encore prête à livrer.");
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: params.orderId },
    include: { restaurant: { select: { name: true } } },
  });

  await prisma.orderStatusEvent.create({
    data: { orderId: order.id, fromStatus: 'READY', toStatus: 'OUT_FOR_DELIVERY', byUserId: params.courierId },
  });

  await notifyOrderStatusChanged(order.restaurantId, order.id, order.number, 'OUT_FOR_DELIVERY');
  await smsOrderStatusChanged({
    customerPhone: order.customerPhone,
    restaurantName: order.restaurant.name,
    orderNumber: order.number,
    status: 'OUT_FOR_DELIVERY',
  });
  await recordAudit({
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
    actorUserId: params.courierId,
    actorEmail: params.courierEmail,
    restaurantId: params.restaurantId,
    targetType: 'order',
    targetId: order.id,
    metadata: { from: 'READY', to: 'OUT_FOR_DELIVERY', number: order.number, courierId: params.courierId },
  });

  return order;
}

/**
 * Confirmation de livraison par le livreur.
 *
 * Le code à six chiffres, connu du client, prouve que le livreur se trouve
 * bien face au bon destinataire — sans lui, n'importe quel livreur pourrait
 * clore n'importe quelle course.
 *
 * Un paiement déjà réglé en ligne clôt directement la commande : rien
 * n'attend plus. Un paiement encore en attente (espèces à la livraison)
 * s'arrête à `DELIVERED` — la remise est confirmée, mais pas l'encaissement,
 * que le livreur n'a pas forcément versé au restaurant à cet instant précis.
 * `confirmDeliveryPayment` termine la commande une fois cet argent reçu.
 */
export async function confirmDelivery(params: {
  restaurantId: string;
  orderId: string;
  courierId: string;
  courierEmail?: string | null;
  code: string;
  ip?: string | null;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    select: { id: true, status: true, courierId: true, deliveryCode: true },
  });
  if (!order) throw new NotFoundError('Livraison introuvable.');
  if (order.courierId !== params.courierId) {
    throw new ForbiddenError("Cette livraison n'est pas la vôtre.");
  }
  if (order.status !== 'OUT_FOR_DELIVERY') {
    throw new ConflictError("Cette commande n'est pas en cours de livraison.");
  }
  if (order.deliveryCode !== params.code) {
    throw new ValidationError('Code de livraison incorrect.', {
      code: 'Vérifiez le code auprès du client.',
    });
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
  });
  const alreadyPaid = payment?.status === 'PAID';

  return updateOrderStatus({
    restaurantId: params.restaurantId,
    orderId: order.id,
    status: alreadyPaid ? 'COMPLETED' : 'DELIVERED',
    userId: params.courierId,
    actorEmail: params.courierEmail,
    ip: params.ip,
  });
}

/**
 * Confirmation d'encaissement par le restaurant, une fois le livreur revenu
 * avec l'argent : seule action qui fait passer une commande `DELIVERED` à
 * `COMPLETED`. Volontairement distincte de `updateOrderStatus` générique —
 * elle encaisse le paiement dans le même geste, pour qu'une commande livrée
 * ne se retrouve jamais « terminée » avec un paiement resté en attente.
 */
export async function confirmDeliveryPayment(params: {
  restaurantId: string;
  orderId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    select: { id: true, status: true },
  });
  if (!order) throw new NotFoundError('Commande introuvable.');
  if (order.status !== 'DELIVERED') {
    throw new ConflictError("Cette commande n'est pas en attente de confirmation de paiement.");
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
  });
  if (payment && payment.status !== 'PAID') {
    await applyPaymentStatus({
      restaurantId: params.restaurantId,
      paymentId: payment.id,
      status: 'PAID',
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
    });
  }

  const updated = await updateOrderStatus({
    restaurantId: params.restaurantId,
    orderId: order.id,
    status: 'COMPLETED',
    userId: params.actorUserId,
    actorEmail: params.actorEmail,
    ip: params.ip,
  });

  return { ...updated, paymentStatus: 'PAID' as const };
}
