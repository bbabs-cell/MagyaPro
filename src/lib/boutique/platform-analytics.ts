import { prisma } from '@/lib/db';

/**
 * Analytics plateforme pour MagyaPro Boutique — équivalent de
 * `getPlatformAnalytics` (Restaurant, `src/lib/analytics.ts`), mais sur les
 * tables Boutique (`Store`, `Sale`, `StoreSubscription`) : les deux produits
 * n'ont pas le même modèle de données, donc pas de fonction partagée.
 *
 * Les boutiques de démonstration (`isDemo: true`) sont exclues : ce sont des
 * vitrines, pas une activité réelle.
 */

const NOT_DEMO_STORE = { isDemo: false };
const COUNTED_SALES = { status: { not: 'CANCELLED' as const } };

function monthlyEquivalent(price: number, interval: 'MONTH' | 'YEAR'): number {
  return interval === 'YEAR' ? Math.round(price / 12) : price;
}

export type PlatformStoreMetrics = {
  stores: number;
  activeStores: number;
  suspendedStores: number;
  sales: number;
  grossVolume: number;
  subscriptionsByStatus: Record<string, number>;
  newStores: number;
};

/** Statistiques globales des boutiques, pour le Super Admin. */
export async function getPlatformStoreMetrics(): Promise<PlatformStoreMetrics> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [stores, activeStores, suspendedStores, sales, revenue, subscriptions, newStores] =
    await Promise.all([
      prisma.store.count({ where: NOT_DEMO_STORE }),
      prisma.store.count({ where: { status: 'ACTIVE', ...NOT_DEMO_STORE } }),
      prisma.store.count({ where: { status: 'SUSPENDED', ...NOT_DEMO_STORE } }),
      prisma.sale.count({ where: { ...COUNTED_SALES, store: NOT_DEMO_STORE } }),
      prisma.sale.aggregate({
        where: { ...COUNTED_SALES, store: NOT_DEMO_STORE },
        _sum: { total: true },
      }),
      prisma.storeSubscription.groupBy({
        by: ['status'],
        where: { store: NOT_DEMO_STORE },
        _count: true,
      }),
      prisma.store.count({ where: { createdAt: { gte: thirtyDaysAgo }, ...NOT_DEMO_STORE } }),
    ]);

  return {
    stores,
    activeStores,
    suspendedStores,
    sales,
    grossVolume: revenue._sum.total ?? 0,
    subscriptionsByStatus: Object.fromEntries(subscriptions.map((row) => [row.status, row._count])),
    newStores,
  };
}

export type PlatformStoreAnalytics = {
  mrrByCurrency: Record<string, number>;
  signupsByMonth: Array<{ month: string; count: number }>;
  gmvByMonth: Array<{ month: string; amount: number }>;
  byPlan: Array<{ planId: string; planName: string; count: number; mrr: number; currency: string }>;
  churn: { cancelledLast30: number; activeAtPeriodStart: number; rate: number | null };
};

/** Analyses approfondies des boutiques, pour le Super Admin. */
export async function getPlatformStoreAnalytics(months = 6): Promise<PlatformStoreAnalytics> {
  const monthsAgo = new Date();
  monthsAgo.setDate(1);
  monthsAgo.setHours(0, 0, 0, 0);
  monthsAgo.setMonth(monthsAgo.getMonth() - (months - 1));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activeSubscriptions, stores, sales, activeAtPeriodStart, cancelledLast30] =
    await Promise.all([
      prisma.storeSubscription.findMany({
        where: { status: 'ACTIVE', store: NOT_DEMO_STORE },
        select: {
          plan: { select: { id: true, name: true, price: true, currency: true, interval: true } },
        },
      }),
      prisma.store.findMany({
        where: { createdAt: { gte: monthsAgo }, ...NOT_DEMO_STORE },
        select: { createdAt: true },
      }),
      prisma.sale.findMany({
        where: { ...COUNTED_SALES, createdAt: { gte: monthsAgo }, store: NOT_DEMO_STORE },
        select: { createdAt: true, total: true },
      }),
      prisma.storeSubscription.count({
        where: { createdAt: { lt: thirtyDaysAgo }, status: { not: 'CANCELLED' }, store: NOT_DEMO_STORE },
      }),
      prisma.storeSubscription.count({
        where: { status: 'CANCELLED', cancelledAt: { gte: thirtyDaysAgo }, store: NOT_DEMO_STORE },
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
      byPlanMap.set(plan.id, { planId: plan.id, planName: plan.name, count: 1, mrr: monthly, currency: plan.currency });
    }
  }

  const monthKeys: string[] = [];
  const cursor = new Date(monthsAgo);
  for (let i = 0; i < months; i++) {
    monthKeys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const monthKeyOf = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const signupCounts = new Map(monthKeys.map((key) => [key, 0]));
  for (const store of stores) {
    const key = monthKeyOf(store.createdAt);
    if (signupCounts.has(key)) signupCounts.set(key, (signupCounts.get(key) ?? 0) + 1);
  }

  const gmvSums = new Map(monthKeys.map((key) => [key, 0]));
  for (const sale of sales) {
    const key = monthKeyOf(sale.createdAt);
    if (gmvSums.has(key)) gmvSums.set(key, (gmvSums.get(key) ?? 0) + sale.total);
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
    signupsByMonth: monthKeys.map((key) => ({ month: labelFor(key), count: signupCounts.get(key) ?? 0 })),
    gmvByMonth: monthKeys.map((key) => ({ month: labelFor(key), amount: gmvSums.get(key) ?? 0 })),
    byPlan: [...byPlanMap.values()].sort((a, b) => b.mrr - a.mrr),
    churn: {
      cancelledLast30,
      activeAtPeriodStart,
      rate: activeAtPeriodStart > 0 ? cancelledLast30 / activeAtPeriodStart : null,
    },
  };
}
