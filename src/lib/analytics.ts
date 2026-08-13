import { prisma } from '@/lib/db';

/**
 * Statistiques.
 *
 * Toutes les valeurs proviennent d'agrégations sur les données réelles du
 * restaurant. Lorsqu'une métrique n'est pas calculable (pas encore de
 * commande, pas d'historique de comparaison), elle vaut `null` et l'interface
 * affiche un état vide — jamais un chiffre inventé ni un zéro trompeur.
 *
 * Le chiffre d'affaires exclut systématiquement les commandes annulées.
 */

export const PERIODS = {
  today: { label: "Aujourd'hui", days: 1 },
  '7d': { label: '7 jours', days: 7 },
  '30d': { label: '30 jours', days: 30 },
  '3m': { label: '3 mois', days: 90 },
  '1y': { label: 'Année', days: 365 },
} as const;

export type PeriodKey = keyof typeof PERIODS;

export function isPeriodKey(value: string): value is PeriodKey {
  return value in PERIODS;
}

export function periodRange(period: PeriodKey): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - PERIODS[period].days);
  }

  return { from, to };
}

/** Période immédiatement précédente, de même durée, pour la comparaison. */
function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: from };
}

/** Les commandes annulées ne comptent ni en revenu ni en volume. */
const COUNTED_ORDERS = { status: { not: 'CANCELLED' as const } };

export type DashboardMetrics = {
  revenue: number;
  ordersCount: number;
  averageBasket: number | null;
  newCustomers: number;
  /** Variation en pourcentage vs période précédente, `null` si incalculable. */
  revenueChange: number | null;
  ordersChange: number | null;
  pendingOrders: number;
  completedOrders: number;
  visitors: number;
  /** Part des visiteurs ayant commandé. `null` si aucun visiteur mesuré. */
  conversionRate: number | null;
};

export async function getDashboardMetrics(
  restaurantId: string,
  period: PeriodKey = '30d',
): Promise<DashboardMetrics> {
  const { from, to } = periodRange(period);
  const previous = previousRange(from, to);

  const [current, prior, pending, completed, newCustomers, visitors] =
    await Promise.all([
      prisma.order.aggregate({
        where: { restaurantId, placedAt: { gte: from, lte: to }, ...COUNTED_ORDERS },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          restaurantId,
          placedAt: { gte: previous.from, lt: previous.to },
          ...COUNTED_ORDERS,
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.count({
        where: {
          restaurantId,
          status: { in: ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
        },
      }),
      prisma.order.count({
        where: { restaurantId, status: 'COMPLETED', placedAt: { gte: from, lte: to } },
      }),
      prisma.customer.count({
        where: { restaurantId, createdAt: { gte: from, lte: to } },
      }),
      // Visiteurs distincts : on compte les identifiants de visiteur uniques,
      // pas les pages vues.
      prisma.analyticsEvent
        .findMany({
          where: {
            restaurantId,
            type: 'PAGE_VIEW',
            occurredAt: { gte: from, lte: to },
            visitorId: { not: null },
          },
          select: { visitorId: true },
          distinct: ['visitorId'],
        })
        .then((rows) => rows.length),
    ]);

  const revenue = current._sum.total ?? 0;
  const priorRevenue = prior._sum.total ?? 0;

  return {
    revenue,
    ordersCount: current._count,
    averageBasket: current._count > 0 ? Math.round(revenue / current._count) : null,
    newCustomers,
    revenueChange: percentChange(priorRevenue, revenue),
    ordersChange: percentChange(prior._count, current._count),
    pendingOrders: pending,
    completedOrders: completed,
    visitors,
    conversionRate:
      visitors > 0 ? Math.round((current._count / visitors) * 1000) / 10 : null,
  };
}

/**
 * Variation en pourcentage.
 *
 * `null` lorsque la période précédente est vide : passer de 0 à 5 commandes
 * n'est pas « +∞ % », c'est un premier chiffre, et l'afficher comme une
 * progression serait mensonger.
 */
function percentChange(before: number, after: number): number | null {
  if (before === 0) return null;
  return Math.round(((after - before) / before) * 1000) / 10;
}

export type RevenuePoint = { date: string; revenue: number; orders: number };

/**
 * Série temporelle du chiffre d'affaires, jour par jour.
 * Les jours sans commande sont inclus avec une valeur nulle : sans eux, la
 * courbe donnerait une fausse impression de continuité.
 */
export async function getRevenueSeries(
  restaurantId: string,
  period: PeriodKey = '30d',
): Promise<RevenuePoint[]> {
  const { from, to } = periodRange(period);

  const orders = await prisma.order.findMany({
    where: { restaurantId, placedAt: { gte: from, lte: to }, ...COUNTED_ORDERS },
    select: { placedAt: true, total: true },
    orderBy: { placedAt: 'asc' },
  });

  const buckets = new Map<string, { revenue: number; orders: number }>();

  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    buckets.set(cursor.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const order of orders) {
    const key = order.placedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += order.total;
      bucket.orders += 1;
    }
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

export type PopularProduct = {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
};

/** Plats les plus vendus, mesurés sur les lignes de commande réelles. */
export async function getPopularProducts(
  restaurantId: string,
  period: PeriodKey = '30d',
  limit = 5,
): Promise<PopularProduct[]> {
  const { from, to } = periodRange(period);

  const items = await prisma.orderItem.findMany({
    where: {
      order: { restaurantId, placedAt: { gte: from, lte: to }, ...COUNTED_ORDERS },
    },
    select: { productId: true, productName: true, quantity: true, lineTotal: true },
  });

  // Le regroupement se fait sur le nom figé plutôt que sur l'identifiant : un
  // produit supprimé du menu conserve ainsi ses ventes passées dans le
  // classement.
  const totals = new Map<string, PopularProduct>();
  for (const item of items) {
    const entry = totals.get(item.productName) ?? {
      productId: item.productId,
      name: item.productName,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += item.quantity;
    entry.revenue += item.lineTotal;
    totals.set(item.productName, entry);
  }

  return [...totals.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

/** Répartition des commandes par heure — pour identifier les coups de feu. */
export async function getHourlyActivity(
  restaurantId: string,
  period: PeriodKey = '30d',
): Promise<Array<{ hour: number; orders: number }>> {
  const { from, to } = periodRange(period);

  const orders = await prisma.order.findMany({
    where: { restaurantId, placedAt: { gte: from, lte: to }, ...COUNTED_ORDERS },
    select: { placedAt: true },
  });

  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  for (const order of orders) {
    hours[order.placedAt.getHours()]!.orders += 1;
  }
  return hours;
}

/**
 * Enregistre un événement d'audience.
 *
 * Sans effet sur la réponse : une erreur de mesure ne doit jamais empêcher
 * l'affichage d'une page publique.
 */
export async function trackEvent(input: {
  restaurantId: string;
  type: 'PAGE_VIEW' | 'PRODUCT_VIEW' | 'ADD_TO_CART' | 'CHECKOUT_STARTED' | 'ORDER_PLACED';
  path?: string;
  visitorId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        restaurantId: input.restaurantId,
        type: input.type,
        path: input.path?.slice(0, 300) ?? null,
        visitorId: input.visitorId ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  } catch (error) {
    console.error('[analytics] Événement non enregistré :', error);
  }
}

/** Statistiques globales de la plateforme, pour le Super Admin. */
export async function getPlatformMetrics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    restaurants,
    activeRestaurants,
    suspendedRestaurants,
    users,
    orders,
    revenue,
    subscriptions,
    newRestaurants,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: 'ACTIVE' } }),
    prisma.restaurant.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count(),
    prisma.order.count({ where: COUNTED_ORDERS }),
    prisma.order.aggregate({ where: COUNTED_ORDERS, _sum: { total: true } }),
    prisma.subscription.groupBy({ by: ['status'], _count: true }),
    prisma.restaurant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  return {
    restaurants,
    activeRestaurants,
    suspendedRestaurants,
    users,
    orders,
    // Volume brut traité par la plateforme, toutes devises confondues : à ne
    // pas confondre avec le revenu de Magya, qui provient des abonnements.
    grossVolume: revenue._sum.total ?? 0,
    subscriptionsByStatus: Object.fromEntries(
      subscriptions.map((row) => [row.status, row._count]),
    ) as Record<string, number>,
    newRestaurants,
  };
}
