import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Courses visibles par un livreur : celles qui sont libres, et les siennes.
 *
 * Cette lecture existait en double — une fois dans la page, une fois dans la
 * route interrogée toutes les quinze secondes par le même écran. Les deux
 * copies devaient rester identiques champ pour champ, sans que rien ne
 * l'impose : la première divergence a suffi à casser le typage, et une
 * divergence plus discrète aurait donné un écran dont le contenu change au
 * premier rafraîchissement automatique.
 *
 * ## Ce que le livreur voit, et ce qu'il ne voit pas
 *
 * Il voit le **reste à percevoir**, pas l'historique des règlements. Une
 * commande à moitié réglée en ligne n'affiche que le solde : c'est la seule
 * chose qu'il ait à réclamer, et réclamer deux fois la même somme sur le pas
 * d'une porte est l'incident le plus coûteux de la tournée.
 *
 * Les lignes de paiement servent au calcul et ne sortent pas de cette
 * fonction.
 */

const SELECT = {
  id: true,
  number: true,
  customerName: true,
  customerPhone: true,
  deliveryAddress: true,
  deliveryLat: true,
  deliveryLng: true,
  total: true,
  currency: true,
  placedAt: true,
  statusUpdatedAt: true,
  paymentStatus: true,
  payments: {
    // `PROCESSING` compte comme réglé du point de vue du client : c'est de
    // l'argent qu'il a déjà donné, même s'il n'est pas encore arrivé au
    // restaurant.
    where: { status: { in: ['PAID', 'PROCESSING'] } },
    select: { amount: true },
  },
  // Pas de `as const` : Prisma refuse un tableau en lecture seule dans un
  // filtre `in`, et l'objet entier marqué constant le figerait.
} satisfies Prisma.OrderSelect;

type Row = Prisma.OrderGetPayload<{ select: typeof SELECT }>;

export type CourierDelivery = Omit<Row, 'payments' | 'placedAt' | 'statusUpdatedAt'> & {
  placedAt: string;
  statusUpdatedAt: string;
  /** Reste réellement à percevoir. Zéro si la commande est déjà réglée. */
  amountDue: number;
};

function shape(order: Row): CourierDelivery {
  const { payments, placedAt, statusUpdatedAt, ...rest } = order;
  const settled = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    ...rest,
    placedAt: placedAt.toISOString(),
    statusUpdatedAt: statusUpdatedAt.toISOString(),
    amountDue: Math.max(0, order.total - settled),
  };
}

export async function listCourierDeliveries(params: {
  restaurantId: string;
  courierId: string;
}): Promise<{ pool: CourierDelivery[]; mine: CourierDelivery[] }> {
  const [pool, mine] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: params.restaurantId,
        fulfillmentType: 'DELIVERY',
        status: 'READY',
        courierId: null,
      },
      orderBy: { statusUpdatedAt: 'asc' },
      select: SELECT,
    }),
    prisma.order.findMany({
      where: {
        restaurantId: params.restaurantId,
        courierId: params.courierId,
        status: 'OUT_FOR_DELIVERY',
      },
      orderBy: { statusUpdatedAt: 'asc' },
      select: SELECT,
    }),
  ]);

  return { pool: pool.map(shape), mine: mine.map(shape) };
}
