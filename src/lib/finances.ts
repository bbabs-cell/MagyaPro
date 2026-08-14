import { prisma } from '@/lib/db';
import { periodRange, type PeriodKey } from '@/lib/analytics';

/**
 * Finances avancées : marge par plat, dépenses, moyenne par jour travaillé.
 *
 * Complète `analytics.ts` plutôt que le dupliquer — le chiffre d'affaires et
 * le panier moyen restent calculés là-bas.
 */

export type ProductMargin = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  margin: number;
  marginPercent: number;
};

/** Uniquement les plats pour lesquels un coût de revient a été renseigné. */
export async function getProductMargins(restaurantId: string): Promise<ProductMargin[]> {
  const products = await prisma.product.findMany({
    where: { restaurantId, costPrice: { not: null } },
    select: { id: true, name: true, price: true, costPrice: true },
    orderBy: { name: 'asc' },
  });

  return products.map((product) => {
    const costPrice = product.costPrice!;
    const margin = product.price - costPrice;
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      costPrice,
      margin,
      marginPercent: product.price > 0 ? Math.round((margin / product.price) * 100) : 0,
    };
  });
}

/**
 * Chiffre d'affaires moyen par jour où au moins une commande a été passée —
 * distinct d'une moyenne sur tous les jours calendaires, qui écraserait la
 * performance réelle des jours d'ouverture avec les jours fermés.
 */
export async function getAverageRevenuePerWorkedDay(
  restaurantId: string,
  period: PeriodKey,
): Promise<{ average: number | null; workedDays: number }> {
  const { from, to } = periodRange(period);

  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { not: 'CANCELLED' }, placedAt: { gte: from, lte: to } },
    select: { total: true, placedAt: true },
  });

  if (orders.length === 0) return { average: null, workedDays: 0 };

  const byDay = new Map<string, number>();
  for (const order of orders) {
    const day = order.placedAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + order.total);
  }

  const totalRevenue = [...byDay.values()].reduce((sum, value) => sum + value, 0);
  const workedDays = byDay.size;

  return { average: Math.round(totalRevenue / workedDays), workedDays };
}

export type ExpenseSummary = {
  total: number;
  byCategory: Record<string, number>;
};

export async function getExpensesSummary(
  restaurantId: string,
  period: PeriodKey,
): Promise<ExpenseSummary> {
  const { from, to } = periodRange(period);

  const expenses = await prisma.expense.findMany({
    where: { restaurantId, incurredAt: { gte: from, lte: to } },
    select: { amount: true, category: true },
  });

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const expense of expenses) {
    total += expense.amount;
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + expense.amount;
  }

  return { total, byCategory };
}
