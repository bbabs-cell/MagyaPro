import { prisma } from '@/lib/db';
import { sumByCurrency, type MoneyByCurrency } from '@/lib/money';
import { COUNTED_STORE } from '@/lib/counted-accounts';

/**
 * Analytics plateforme pour MagyaPro Boutique — équivalent de
 * `getPlatformAnalytics` (Restaurant, `src/lib/analytics.ts`), mais sur les
 * tables Boutique (`Store`, `Sale`, `StoreSubscription`) : les deux produits
 * n'ont pas le même modèle de données, donc pas de fonction partagée.
 *
 * Les boutiques de démonstration et de test sont exclues (`COUNTED_STORE`,
 * voir `counted-accounts.ts`) : ce ne sont pas des clients.
 */

const COUNTED_SALES = { status: { not: 'CANCELLED' as const } };

function monthlyEquivalent(price: number, interval: 'MONTH' | 'YEAR'): number {
  return interval === 'YEAR' ? Math.round(price / 12) : price;
}

/**
 * Devise de repli quand une boutique a disparu entre l'agrégation des ventes
 * et la lecture des boutiques. Mieux vaut ranger le montant sous la devise la
 * plus probable que le perdre ou l'attribuer au hasard.
 */
const DEFAULT_STORE_CURRENCY = 'XOF';

/** Devise de chaque boutique citée, en une requête. */
async function storeCurrencies(storeIds: string[]): Promise<Map<string, string>> {
  if (storeIds.length === 0) return new Map();
  const stores = await prisma.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, currency: true },
  });
  return new Map(stores.map((store) => [store.id, store.currency]));
}

export type PlatformStoreMetrics = {
  stores: number;
  activeStores: number;
  suspendedStores: number;
  sales: number;
  grossVolumeByCurrency: MoneyByCurrency;
  subscriptionsByStatus: Record<string, number>;
  newStores: number;
};

/** Statistiques globales des boutiques, pour le Super Admin. */
export async function getPlatformStoreMetrics(): Promise<PlatformStoreMetrics> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [stores, activeStores, suspendedStores, sales, revenue, subscriptions, newStores] =
    await Promise.all([
      prisma.store.count({ where: COUNTED_STORE }),
      prisma.store.count({ where: { status: 'ACTIVE', ...COUNTED_STORE } }),
      prisma.store.count({ where: { status: 'SUSPENDED', ...COUNTED_STORE } }),
      prisma.sale.count({ where: { ...COUNTED_SALES, store: COUNTED_STORE } }),
      // `Sale` ne porte pas de devise : elle est celle de sa boutique. On
      // remonte donc la boutique plutôt que d'additionner à l'aveugle des
      // montants de monnaies différentes.
      prisma.sale.groupBy({
        by: ['storeId'],
        where: { ...COUNTED_SALES, store: COUNTED_STORE },
        _sum: { total: true },
      }),
      prisma.storeSubscription.groupBy({
        by: ['status'],
        where: { store: COUNTED_STORE },
        _count: true,
      }),
      prisma.store.count({ where: { createdAt: { gte: thirtyDaysAgo }, ...COUNTED_STORE } }),
    ]);

  const currencyByStore = await storeCurrencies(revenue.map((row) => row.storeId));

  return {
    stores,
    activeStores,
    suspendedStores,
    sales,
    grossVolumeByCurrency: sumByCurrency(
      revenue.map((row) => ({
        amount: row._sum.total ?? 0,
        currency: currencyByStore.get(row.storeId) ?? DEFAULT_STORE_CURRENCY,
      })),
    ),
    subscriptionsByStatus: Object.fromEntries(subscriptions.map((row) => [row.status, row._count])),
    newStores,
  };
}

export type PlatformStoreAnalytics = {
  mrrByCurrency: Record<string, number>;
  signupsByMonth: Array<{ month: string; count: number }>;
  /** Volume brut par mois, tenu par devise — jamais additionné entre monnaies. */
  gmvByMonth: Array<{ month: string; byCurrency: MoneyByCurrency }>;
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
        where: { status: 'ACTIVE', store: COUNTED_STORE },
        select: {
          plan: { select: { id: true, name: true, price: true, currency: true, interval: true } },
        },
      }),
      prisma.store.findMany({
        where: { createdAt: { gte: monthsAgo }, ...COUNTED_STORE },
        select: { createdAt: true },
      }),
      prisma.sale.findMany({
        where: { ...COUNTED_SALES, createdAt: { gte: monthsAgo }, store: COUNTED_STORE },
        select: { createdAt: true, total: true, storeId: true },
      }),
      prisma.storeSubscription.count({
        where: { createdAt: { lt: thirtyDaysAgo }, status: { not: 'CANCELLED' }, store: COUNTED_STORE },
      }),
      prisma.storeSubscription.count({
        where: { status: 'CANCELLED', cancelledAt: { gte: thirtyDaysAgo }, store: COUNTED_STORE },
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

  const saleCurrencies = await storeCurrencies([...new Set(sales.map((sale) => sale.storeId))]);

  // Un seau par mois, et dans chaque seau un montant par devise.
  const gmvSums = new Map<string, MoneyByCurrency>(monthKeys.map((key) => [key, {}]));
  for (const sale of sales) {
    const bucket = gmvSums.get(monthKeyOf(sale.createdAt));
    if (!bucket) continue;
    const code = (saleCurrencies.get(sale.storeId) ?? DEFAULT_STORE_CURRENCY).toUpperCase();
    bucket[code] = (bucket[code] ?? 0) + sale.total;
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
    gmvByMonth: monthKeys.map((key) => ({ month: labelFor(key), byCurrency: gmvSums.get(key) ?? {} })),
    byPlan: [...byPlanMap.values()].sort((a, b) => b.mrr - a.mrr),
    churn: {
      cancelledLast30,
      activeAtPeriodStart,
      rate: activeAtPeriodStart > 0 ? cancelledLast30 / activeAtPeriodStart : null,
    },
  };
}
