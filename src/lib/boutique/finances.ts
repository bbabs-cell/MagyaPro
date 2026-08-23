import { prisma } from '@/lib/db';
import { periodRange, type PeriodKey } from '@/lib/analytics';
import { toQty } from '@/lib/boutique/quantity';

/**
 * Vue comptable Boutique : recettes, coût des marchandises vendues, retours,
 * pertes de stock, dépenses, trésorerie — complète `analytics.ts` (chiffre
 * d'affaires brut, panier moyen) sans le dupliquer.
 *
 * Rien n'est estimé : chaque montant vient d'une écriture réelle déjà
 * enregistrée (vente, retour, mouvement de stock, dépense, mouvement de
 * caisse) — jamais une valeur reconstituée après coup.
 */

/** Ventes annulées exclues, comme dans `analytics.ts`. */
const COUNTED_SALES = { status: { not: 'CANCELLED' as const } };

export type ProductMargin = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  margin: number;
  marginPercent: number;
};

/** Marge par variante — uniquement celles ayant un coût d'achat renseigné. */
export async function getStoreProductMargins(storeId: string): Promise<ProductMargin[]> {
  const variants = await prisma.storeProductVariant.findMany({
    where: { product: { storeId }, cost: { gt: 0 } },
    select: { id: true, price: true, cost: true, product: { select: { name: true } }, sku: true },
    orderBy: { product: { name: 'asc' } },
  });

  return variants.map((variant) => {
    const margin = variant.price - variant.cost;
    return {
      id: variant.id,
      name: variant.sku ? `${variant.product.name} · ${variant.sku}` : variant.product.name,
      price: variant.price,
      costPrice: variant.cost,
      margin,
      marginPercent: variant.price > 0 ? Math.round((margin / variant.price) * 100) : 0,
    };
  });
}

export type ExpenseSummary = { total: number; byCategory: Record<string, number> };

export async function getStoreExpensesSummary(storeId: string, period: PeriodKey): Promise<ExpenseSummary> {
  const { from, to } = periodRange(period);

  const expenses = await prisma.storeExpense.findMany({
    where: { storeId, incurredAt: { gte: from, lte: to } },
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

/**
 * Coût des marchandises vendues (COGS) sur la période, valorisé au coût
 * *actuel* de chaque variante — une vente ancienne ne garde pas le coût
 * d'achat en vigueur au moment de la vente, seul le prix de vente
 * (`SaleItem.unitPrice`) est figé. Acceptable pour une vue d'ensemble, à
 * revoir si un historique de coût précis devient nécessaire.
 */
export async function getStoreCogs(storeId: string, period: PeriodKey): Promise<number> {
  const { from, to } = periodRange(period);

  const items = await prisma.saleItem.findMany({
    where: { sale: { storeId, createdAt: { gte: from, lte: to }, ...COUNTED_SALES } },
    select: { quantity: true, productVariant: { select: { cost: true } } },
  });

  return items.reduce((sum, item) => sum + toQty(item.quantity) * item.productVariant.cost, 0);
}

/** Montant remboursé aux clients sur la période (retours résolus en remboursement). */
export async function getStoreReturnsTotal(storeId: string, period: PeriodKey): Promise<number> {
  const { from, to } = periodRange(period);

  const returns = await prisma.storeReturn.findMany({
    where: {
      storeId,
      resolution: 'REFUND',
      status: 'COMPLETED',
      createdAt: { gte: from, lte: to },
    },
    select: { items: { select: { quantity: true, unitPrice: true } } },
  });

  return returns.reduce(
    (sum, r) => sum + r.items.reduce((s, item) => s + toQty(item.quantity) * item.unitPrice, 0),
    0,
  );
}

/**
 * Pertes de stock : sorties manuelles (casse, vol, péremption constatée) —
 * un ajustement `ADJUSTMENT` négatif, valorisé au coût d'achat actuel de la
 * variante. Un ajustement positif (correction d'un comptage sous-évalué)
 * n'est jamais une perte, il est ignoré ici.
 */
export async function getStoreStockLosses(storeId: string, period: PeriodKey): Promise<number> {
  const { from, to } = periodRange(period);

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      storeId,
      type: 'ADJUSTMENT',
      quantityChange: { lt: 0 },
      createdAt: { gte: from, lte: to },
    },
    select: { quantityChange: true, productVariant: { select: { cost: true } } },
  });

  return movements.reduce(
    (sum, m) => sum + Math.abs(toQty(m.quantityChange)) * m.productVariant.cost,
    0,
  );
}

export type CashFlow = { cashIn: number; cashOut: number; net: number };

/**
 * Mouvements de caisse en espèces sur la période — ventes réglées en
 * espèces et dépôts d'un côté, retraits et dépenses payées en caisse de
 * l'autre. Une estimation de trésorerie, pas un solde de compte bancaire :
 * les paiements mobile money/carte ne transitent jamais par la caisse
 * physique.
 */
export async function getStoreCashFlow(storeId: string, period: PeriodKey): Promise<CashFlow> {
  const { from, to } = periodRange(period);

  const [cashPayments, movements] = await Promise.all([
    prisma.storePayment.aggregate({
      where: {
        method: 'cash',
        sale: { storeId, createdAt: { gte: from, lte: to }, ...COUNTED_SALES },
      },
      _sum: { amount: true },
    }),
    prisma.cashMovement.findMany({
      where: { cashSession: { storeId }, createdAt: { gte: from, lte: to }, type: { not: 'SALE' } },
      select: { type: true, amount: true },
    }),
  ]);

  let cashIn = cashPayments._sum.amount ?? 0;
  let cashOut = 0;
  for (const movement of movements) {
    if (movement.type === 'DEPOSIT') cashIn += movement.amount;
    else cashOut += movement.amount;
  }

  return { cashIn, cashOut, net: cashIn - cashOut };
}
