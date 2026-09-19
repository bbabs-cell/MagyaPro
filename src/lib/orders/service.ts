import type { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { priceOrder, type CartInput } from '@/lib/orders/pricing';
import { notifyNewOrder, notifyOrderStatusChanged } from '@/lib/notifications';
import { smsOrderConfirmation, smsOrderStatusChanged } from '@/lib/customer-notifications';
import { applyPaymentStatus, newPaymentReference } from '@/lib/payments/service';
import {
  InvalidCollectionError,
  collectionMethodLabel,
  isCollectionMethod,
  resolveCollection,
  type CollectionOutcome,
} from '@/lib/orders/delivery-collection';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ORDER_STATUS_LABELS, canTransition } from '@/lib/orders/status';
import { generateSixDigitCode } from '@/lib/codes';
import { grantLoyaltyRewards } from '@/lib/loyalty';
import { formatMoney } from '@/lib/money';

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
      paymentStatus: true,
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

  /**
   * Terminer une commande, c'est aussi acter que l'argent est là.
   *
   * Une commande à emporter passait de « Prête » à « Terminée » sans que son
   * paiement bouge : elle restait affichée « en attente de paiement » pour
   * toujours, alors qu'elle était réglée au comptoir. Le restaurateur se
   * retrouvait avec une liste de commandes terminées et impayées qui ne
   * correspondait à rien — et une liste fausse finit par ne plus être lue.
   *
   * Un remboursement fait exception : il a déjà tranché la question de
   * l'argent, en sens inverse. Le repasser à « payé » effacerait cette
   * information.
   */
  const settlesPayment =
    params.status === 'COMPLETED' && order.paymentStatus !== 'REFUNDED';

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
        paymentStatus: settlesPayment ? 'PAID' : undefined,
      },
    });

    // Le paiement enregistré doit suivre, sinon la commande se dit payée
    // pendant que sa ligne de paiement reste en attente — deux vérités pour
    // le même fait.
    if (settlesPayment) {
      await tx.payment.updateMany({
        where: { orderId: order.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'PAID' },
      });
    }

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
  /**
   * Ce que le livreur déclare avoir encaissé. Absent pour une commande déjà
   * réglée en ligne : il n'y a alors rien à percevoir sur le pas de la porte.
   */
  collection?: { outcome: CollectionOutcome; amount?: number; method?: string } | null;
  ip?: string | null;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    select: {
      id: true,
      status: true,
      courierId: true,
      deliveryCode: true,
      customerId: true,
      total: true,
      currency: true,
    },
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

  // Rien à encaisser sur une commande déjà réglée en ligne : la déclaration du
  // livreur, si elle arrive quand même, est ignorée plutôt que de créer une
  // seconde ligne de paiement pour la même commande.
  const note = alreadyPaid
    ? null
    : await recordCourierCollection({
        restaurantId: params.restaurantId,
        order,
        collection: params.collection,
        courierId: params.courierId,
        courierEmail: params.courierEmail,
      });

  return updateOrderStatus({
    restaurantId: params.restaurantId,
    orderId: order.id,
    status: alreadyPaid ? 'COMPLETED' : 'DELIVERED',
    userId: params.courierId,
    actorEmail: params.courierEmail,
    note,
    ip: params.ip,
  });
}

/**
 * Enregistre ce que le livreur a reçu du client, et rend la phrase qui sera
 * consignée dans l'historique de la commande.
 *
 * La ligne créée est en `PROCESSING`, pas en `PAID` : l'argent a quitté le
 * client mais n'est pas encore arrivé au restaurant. Voir l'en-tête de
 * `delivery-collection.ts` — c'est la distinction qui empêche le compte de
 * résultat de compter une recette que personne n'a encore touchée.
 */
async function recordCourierCollection(params: {
  restaurantId: string;
  order: { id: string; customerId: string; total: number; currency: string };
  collection?: { outcome: CollectionOutcome; amount?: number; method?: string } | null;
  courierId: string;
  courierEmail?: string | null;
}): Promise<string | null> {
  const { order, collection } = params;
  if (!collection) return null;

  // Ce qui reste réellement à percevoir, et non le total de la commande : un
  // client peut en avoir réglé une partie en ligne. C'est ce même montant que
  // l'écran du livreur affiche — le contrôle du serveur doit porter sur le
  // chiffre qu'on lui a montré, sinon un partiel légitime serait refusé et un
  // partiel excessif accepté.
  const settled = await prisma.payment.aggregate({
    where: { orderId: order.id, status: { in: ['PAID', 'PROCESSING'] } },
    _sum: { amount: true },
  });
  const due = Math.max(0, order.total - (settled._sum.amount ?? 0));

  let resolved;
  try {
    resolved = resolveCollection(due, collection.outcome, collection.amount);
  } catch (failure) {
    if (failure instanceof InvalidCollectionError) {
      throw new ValidationError(failure.message, { amount: failure.message });
    }
    throw failure;
  }

  const money = (value: number) => formatMoney(value, order.currency);

  if (resolved.collected === 0) {
    return `Livré sans paiement — ${money(due)} restent dus.`;
  }

  const method = collection.method ?? '';
  if (!isCollectionMethod(method)) {
    throw new ValidationError('Indiquez comment le client a payé.', {
      method: 'Choisissez un moyen de paiement.',
    });
  }

  // Une commande à régler à la livraison porte déjà une ligne de paiement en
  // attente, créée à la commande avec le moyen choisi par le client. C'est
  // celle-là qu'on renseigne, plutôt que d'en ouvrir une seconde : il n'y a eu
  // qu'un règlement, et deux lignes pour la même somme rendraient la fiche
  // illisible et le total des encaissements faux.
  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const paymentId =
    existing?.id ??
    (
      await prisma.payment.create({
        data: {
          restaurantId: params.restaurantId,
          orderId: order.id,
          customerId: order.customerId,
          provider: method,
          amount: resolved.collected,
          currency: order.currency,
          reference: newPaymentReference(),
          status: 'PENDING',
        },
        select: { id: true },
      })
    ).id;

  // Le moyen et le montant réels ne sont connus qu'ici : le client avait
  // annoncé « paiement à la livraison », il a pu régler par Wave sur le pas de
  // la porte, ou ne donner qu'une partie.
  await prisma.payment.update({
    where: { id: paymentId },
    data: { provider: method, amount: resolved.collected },
  });

  // Le changement de statut passe par `applyPaymentStatus` et non par une
  // écriture directe : c'est lui qui vérifie la transition, aligne le statut
  // de paiement de la commande et consigne l'action. Le contourner laisserait
  // une commande « en attente » avec un paiement « en cours ».
  await applyPaymentStatus({
    restaurantId: params.restaurantId,
    paymentId,
    // Encaissé par le livreur, pas encore remis au restaurant.
    status: 'PROCESSING',
    actorUserId: params.courierId,
    actorEmail: params.courierEmail,
  });

  const label = collectionMethodLabel(method);
  return resolved.fullyPaid
    ? `Encaissé par le livreur : ${money(resolved.collected)} (${label}).`
    : `Encaissé par le livreur : ${money(resolved.collected)} sur ${money(due)} (${label}) — écart de ${money(resolved.shortfall)}.`;
}

/**
 * Encaissement constaté par le restaurant — **sans toucher au statut**.
 *
 * Le paiement était auparavant soudé à la livraison : le seul bouton qui
 * marquait une commande payée s'appelait « Marquer payé et terminer » et
 * n'apparaissait que pour une commande `DELIVERED`. Une commande emportée au
 * comptoir, elle, ne passe jamais par ce statut — il n'existait donc
 * **aucun** moyen de la déclarer payée. Le restaurateur encaissait la main à
 * la caisse et voyait « paiement en attente » à l'écran.
 *
 * Encaisser et terminer sont deux faits distincts, et ils n'arrivent pas
 * toujours dans le même ordre : on paie d'avance au comptoir, on paie à la
 * remise en livraison, et parfois on termine une commande dont l'argent est
 * arrivé la veille. Chacun a donc son geste.
 *
 * Terminer une commande marque toujours le paiement (voir
 * `updateOrderStatus`) : l'inverse — marquer payé — ne termine rien, car une
 * commande payée d'avance est encore à préparer.
 */
export async function markOrderPaid(params: {
  restaurantId: string;
  orderId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    select: { id: true, number: true, status: true, paymentStatus: true },
  });
  if (!order) throw new NotFoundError('Commande introuvable.');

  if (order.status === 'CANCELLED') {
    throw new ConflictError("Une commande annulée ne peut pas être marquée payée.");
  }
  if (order.paymentStatus === 'REFUNDED') {
    throw new ConflictError('Cette commande a été remboursée.');
  }
  if (order.paymentStatus === 'PAID') return order;

  // La ligne de paiement existe pour les règlements en ligne et pour l'argent
  // remis au livreur ; elle est absente d'un règlement au comptoir. Les deux
  // cas sont normaux — on met à jour ce qui existe, on n'invente pas une
  // transaction qui n'a pas eu lieu.
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

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: 'PAID' },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    restaurantId: params.restaurantId,
    targetType: 'order',
    targetId: order.id,
    ip: params.ip,
    metadata: { payment: { from: order.paymentStatus, to: 'PAID' }, number: order.number },
  });

  return updated;
}
