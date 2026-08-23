import { prisma } from '@/lib/db';
import { periodRange, type PeriodKey } from '@/lib/analytics';

/**
 * Statistiques Boutique — même principe que `src/lib/analytics.ts`
 * (Restaurant) : uniquement des agrégations sur les ventes réelles, jamais
 * de valeur inventée. Fichier séparé pour ne pas mélanger les deux produits,
 * même si la logique de calcul (variation vs période précédente, buckets
 * journaliers) est volontairement la même.
 */

function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: from };
}

function percentChange(before: number, after: number): number | null {
  if (before === 0) return null;
  return Math.round(((after - before) / before) * 1000) / 10;
}

/** Les ventes annulées ne comptent ni en revenu ni en volume. */
const COUNTED_SALES = { status: { not: 'CANCELLED' as const } };

export type StoreDashboardMetrics = {
  revenue: number;
  salesCount: number;
  averageBasket: number | null;
  newCustomers: number;
  revenueChange: number | null;
  salesChange: number | null;
};

export async function getStoreDashboardMetrics(
  storeId: string,
  period: PeriodKey = '30d',
): Promise<StoreDashboardMetrics> {
  const { from, to } = periodRange(period);
  const previous = previousRange(from, to);

  const [current, prior, newCustomers] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId, createdAt: { gte: from, lte: to }, ...COUNTED_SALES },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { storeId, createdAt: { gte: previous.from, lt: previous.to }, ...COUNTED_SALES },
      _sum: { total: true },
      _count: true,
    }),
    prisma.storeCustomer.count({ where: { storeId, createdAt: { gte: from, lte: to } } }),
  ]);

  const revenue = current._sum.total ?? 0;
  const priorRevenue = prior._sum.total ?? 0;

  return {
    revenue,
    salesCount: current._count,
    averageBasket: current._count > 0 ? Math.round(revenue / current._count) : null,
    newCustomers,
    revenueChange: percentChange(priorRevenue, revenue),
    salesChange: percentChange(prior._count, current._count),
  };
}

export type StoreRevenuePoint = { date: string; revenue: number; orders: number };

export async function getStoreRevenueSeries(
  storeId: string,
  period: PeriodKey = '30d',
): Promise<StoreRevenuePoint[]> {
  const { from, to } = periodRange(period);

  const sales = await prisma.sale.findMany({
    where: { storeId, createdAt: { gte: from, lte: to }, ...COUNTED_SALES },
    select: { createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map<string, { revenue: number; orders: number }>();
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    buckets.set(cursor.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const sale of sales) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += sale.total;
      bucket.orders += 1;
    }
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

export type StorePopularProduct = { name: string; quantity: number; revenue: number };

export async function getStorePopularProducts(
  storeId: string,
  period: PeriodKey = '30d',
  limit = 5,
): Promise<StorePopularProduct[]> {
  const { from, to } = periodRange(period);

  const items = await prisma.saleItem.findMany({
    where: { sale: { storeId, createdAt: { gte: from, lte: to }, ...COUNTED_SALES } },
    select: { productName: true, quantity: true, total: true },
  });

  const totals = new Map<string, StorePopularProduct>();
  for (const item of items) {
    const entry = totals.get(item.productName) ?? {
      name: item.productName,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += item.quantity;
    entry.revenue += item.total;
    totals.set(item.productName, entry);
  }

  return [...totals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

/** Répartition des ventes par heure — pour identifier les coups de feu. */
export async function getStoreHourlyActivity(
  storeId: string,
  period: PeriodKey = '30d',
): Promise<Array<{ hour: number; orders: number }>> {
  const { from, to } = periodRange(period);

  const sales = await prisma.sale.findMany({
    where: { storeId, createdAt: { gte: from, lte: to }, ...COUNTED_SALES },
    select: { createdAt: true },
  });

  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  for (const sale of sales) {
    hours[sale.createdAt.getHours()]!.orders += 1;
  }
  return hours;
}
