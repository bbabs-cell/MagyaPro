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

/**
 * Exclut les restaurants de démonstration des statistiques plateforme : ce
 * sont des vitrines créées pour l'onboarding, pas une activité réelle — les
 * compter fausserait le chiffre d'affaires et les volumes vus par le Super
 * Admin.
 */
const NOT_DEMO_RESTAURANT = { isDemo: false };

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
    prisma.restaurant.count({ where: NOT_DEMO_RESTAURANT }),
    prisma.restaurant.count({ where: { status: 'ACTIVE', ...NOT_DEMO_RESTAURANT } }),
    prisma.restaurant.count({ where: { status: 'SUSPENDED', ...NOT_DEMO_RESTAURANT } }),
    prisma.user.count(),
    prisma.order.count({ where: { ...COUNTED_ORDERS, restaurant: NOT_DEMO_RESTAURANT } }),
    prisma.order.aggregate({
      where: { ...COUNTED_ORDERS, restaurant: NOT_DEMO_RESTAURANT },
      _sum: { total: true },
    }),
    prisma.subscription.groupBy({
      by: ['status'],
      where: { restaurant: NOT_DEMO_RESTAURANT },
      _count: true,
    }),
    prisma.restaurant.count({
      where: { createdAt: { gte: thirtyDaysAgo }, ...NOT_DEMO_RESTAURANT },
    }),
  ]);

  return {
    restaurants,
    activeRestaurants,
    suspendedRestaurants,
    users,
    orders,
    // Volume brut traité par la plateforme, toutes devises confondues : à ne
    // pas confondre avec le revenu de Magyapro, qui provient des abonnements.
    grossVolume: revenue._sum.total ?? 0,
    subscriptionsByStatus: Object.fromEntries(
      subscriptions.map((row) => [row.status, row._count]),
    ) as Record<string, number>,
    newRestaurants,
  };
}

/** Normalise le prix d'un plan en équivalent mensuel, pour comparer MENSUEL et ANNUEL. */
function monthlyEquivalent(price: number, interval: 'MONTH' | 'YEAR'): number {
  return interval === 'YEAR' ? Math.round(price / 12) : price;
}

export type PlatformAnalytics = {
  /** MRR actuel, par devise — les abonnements résiliés ou en retard n'y contribuent pas. */
  mrrByCurrency: Record<string, number>;
  /** Nouveaux restaurants par mois, sur les `months` derniers mois (dont le mois en cours). */
  signupsByMonth: Array<{ month: string; count: number }>;
  /** Volume brut traité (hors commandes annulées) par mois, toutes devises confondues. */
  gmvByMonth: Array<{ month: string; amount: number }>;
  /** Répartition des abonnements actifs par plan, avec leur contribution au MRR. */
  byPlan: Array<{ planId: string; planName: string; count: number; mrr: number; currency: string }>;
  /** Résiliations dans les 30 derniers jours vs abonnements actifs au début de la période. */
  churn: { cancelledLast30: number; activeAtPeriodStart: number; rate: number | null };
};

/**
 * Analyses approfondies de la plateforme, pour le Super Admin.
 *
 * Toutes les valeurs proviennent de données réellement enregistrées :
 * inscriptions et volumes sont bucketés depuis `createdAt`/`placedAt` en
 * mémoire (le nombre de restaurants reste modeste), sans table de snapshots
 * historiques — il n'existe donc pas d'historique de MRR mois par mois,
 * seulement sa valeur actuelle.
 */
export async function getPlatformAnalytics(months = 6): Promise<PlatformAnalytics> {
  const monthsAgo = new Date();
  monthsAgo.setDate(1);
  monthsAgo.setHours(0, 0, 0, 0);
  monthsAgo.setMonth(monthsAgo.getMonth() - (months - 1));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activeSubscriptions, restaurants, orders, activeAtPeriodStart, cancelledLast30] =
    await Promise.all([
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', restaurant: NOT_DEMO_RESTAURANT },
        select: {
          plan: { select: { id: true, name: true, price: true, currency: true, interval: true } },
        },
      }),
      prisma.restaurant.findMany({
        where: { createdAt: { gte: monthsAgo }, ...NOT_DEMO_RESTAURANT },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: { ...COUNTED_ORDERS, placedAt: { gte: monthsAgo }, restaurant: NOT_DEMO_RESTAURANT },
        select: { placedAt: true, total: true },
      }),
      prisma.subscription.count({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          status: { not: 'CANCELLED' },
          restaurant: NOT_DEMO_RESTAURANT,
        },
      }),
      prisma.subscription.count({
        where: {
          status: 'CANCELLED',
          cancelledAt: { gte: thirtyDaysAgo },
          restaurant: NOT_DEMO_RESTAURANT,
        },
      }),
    ]);

  const mrrByCurrency: Record<string, number> = {};
  const byPlanMap = new Map<
    string,
    { planId: string; planName: string; count: number; mrr: number; currency: string }
  >();
  for (const { plan } of activeSubscriptions) {
    const monthly = monthlyEquivalent(plan.price, plan.interval);
    mrrByCurrency[plan.currency] = (mrrByCurrency[plan.currency] ?? 0) + monthly;
    const existing = byPlanMap.get(plan.id);
    if (existing) {
      existing.count += 1;
      existing.mrr += monthly;
    } else {
      byPlanMap.set(plan.id, {
        planId: plan.id,
        planName: plan.name,
        count: 1,
        mrr: monthly,
        currency: plan.currency,
      });
    }
  }

  // Buckets mensuels initialisés à zéro pour que les mois sans activité
  // apparaissent quand même dans le graphique, plutôt que d'être absents.
  const monthKeys: string[] = [];
  const cursor = new Date(monthsAgo);
  for (let i = 0; i < months; i++) {
    monthKeys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const monthKeyOf = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const signupCounts = new Map(monthKeys.map((key) => [key, 0]));
  for (const restaurant of restaurants) {
    const key = monthKeyOf(restaurant.createdAt);
    if (signupCounts.has(key)) signupCounts.set(key, (signupCounts.get(key) ?? 0) + 1);
  }

  const gmvSums = new Map(monthKeys.map((key) => [key, 0]));
  for (const order of orders) {
    const key = monthKeyOf(order.placedAt);
    if (gmvSums.has(key)) gmvSums.set(key, (gmvSums.get(key) ?? 0) + order.total);
  }

  const MONTH_LABELS = [
    'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
  ];
  const labelFor = (key: string) => {
    const [, month] = key.split('-');
    return MONTH_LABELS[Number(month) - 1] ?? key;
  };

  return {
    mrrByCurrency,
    signupsByMonth: monthKeys.map((key) => ({
      month: labelFor(key),
      count: signupCounts.get(key) ?? 0,
    })),
    gmvByMonth: monthKeys.map((key) => ({
      month: labelFor(key),
      amount: gmvSums.get(key) ?? 0,
    })),
    byPlan: [...byPlanMap.values()].sort((a, b) => b.mrr - a.mrr),
    churn: {
      cancelledLast30,
      activeAtPeriodStart,
      rate: activeAtPeriodStart > 0 ? cancelledLast30 / activeAtPeriodStart : null,
    },
  };
}
