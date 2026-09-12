import { prisma } from '@/lib/db';
import { purchaseBalance } from '@/lib/boutique/purchase-payment';
import { toQty } from '@/lib/boutique/quantity';

/**
 * Rapports Boutique — achats, stock, clients, fournisseurs, dépenses, taxes.
 * Le rapport de ventes reste dans la page (`rapports/page.tsx`, déjà
 * existant) ; celui des employés réutilise `getStoreEmployeePerformance`
 * (`analytics.ts`). Fichier séparé pour ne pas alourdir `finances.ts`, qui
 * porte la vue comptable d'ensemble plutôt que des listes détaillées.
 */

export type PurchaseReportRow = {
  id: string;
  reference: string;
  supplierName: string;
  status: string;
  orderedAt: Date | null;
  receivedAt: Date | null;
  total: number;
};

export async function getPurchasesReport(
  storeId: string,
  from: Date,
  to: Date,
): Promise<{ rows: PurchaseReportRow[]; total: number }> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { storeId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: { select: { name: true } },
      items: { select: { quantityOrdered: true, unitCost: true, discount: true } },
    },
  });

  const rows = orders.map((order) => {
    const total =
      order.items.reduce((sum, item) => sum + toQty(item.quantityOrdered) * item.unitCost - item.discount, 0) +
      order.extraFees;
    return {
      id: order.id,
      reference: order.reference,
      supplierName: order.supplier.name,
      status: order.status,
      orderedAt: order.orderedAt,
      receivedAt: order.receivedAt,
      total,
    };
  });

  return { rows, total: rows.reduce((sum, r) => sum + r.total, 0) };
}

export type StockMovementReportRow = {
  id: string;
  createdAt: Date;
  productName: string;
  type: string;
  quantityChange: number;
  quantityAfter: number;
  reason: string | null;
};

export async function getStockMovementsReport(
  storeId: string,
  from: Date,
  to: Date,
): Promise<{ rows: StockMovementReportRow[]; stockValue: number }> {
  const [movements, variants] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { storeId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { productVariant: { select: { product: { select: { name: true } } } } },
    }),
    prisma.storeProductVariant.findMany({
      where: { product: { storeId } },
      select: { cost: true, inventory: { select: { quantity: true } } },
    }),
  ]);

  const rows = movements.map((m) => ({
    id: m.id,
    createdAt: m.createdAt,
    productName: m.productVariant.product.name,
    type: m.type,
    quantityChange: toQty(m.quantityChange),
    quantityAfter: toQty(m.quantityAfter),
    reason: m.reason,
  }));

  // Valorisation actuelle du stock (indépendante de la période filtrée) :
  // quantité en stock × coût d'achat de chaque variante.
  const stockValue = variants.reduce(
    (sum, v) => sum + v.inventory.reduce((s, inv) => s + toQty(inv.quantity), 0) * v.cost,
    0,
  );

  return { rows, stockValue };
}

export type CustomerReportRow = {
  id: string;
  name: string;
  phone: string;
  salesCount: number;
  totalSpent: number;
  creditBalance: number;
  lastSaleAt: Date | null;
};

export async function getCustomersReport(storeId: string): Promise<CustomerReportRow[]> {
  return prisma.storeCustomer.findMany({
    where: { storeId },
    orderBy: { totalSpent: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      salesCount: true,
      totalSpent: true,
      creditBalance: true,
      lastSaleAt: true,
    },
  });
}

export type SupplierReportRow = {
  id: string;
  name: string;
  phone: string | null;
  /** Valeur de tout ce qui a été commandé, livré ou non. */
  totalPurchased: number;
  totalPaid: number;
  /** Reste dû : valeur livrée moins règlements. Déduit, jamais stocké. */
  outstanding: number;
};

export async function getSuppliersReport(storeId: string): Promise<SupplierReportRow[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { storeId },
    orderBy: { name: 'asc' },
    include: {
      purchaseOrders: {
        select: {
          status: true,
          extraFees: true,
          items: {
            select: {
              quantityOrdered: true,
              quantityReceived: true,
              unitFactor: true,
              unitCost: true,
              discount: true,
            },
          },
          payments: { select: { amount: true } },
        },
      },
    },
  });

  return suppliers.map((supplier) => {
    const totalPurchased = supplier.purchaseOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((s, item) => s + toQty(item.quantityOrdered) * item.unitCost - item.discount, 0) +
        order.extraFees,
      0,
    );
    // Réglé et reste dû se déduisent des commandes, avec la même règle que
    // l'écran Achats — une seule définition du « dû » dans tout le produit.
    let totalPaid = 0;
    let outstanding = 0;
    for (const order of supplier.purchaseOrders) {
      const balance = purchaseBalance(order.items, order.payments);
      totalPaid += balance.paid;
      outstanding += balance.remaining;
    }

    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      totalPurchased,
      totalPaid,
      outstanding,
    };
  }).sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name, 'fr'));
}

export type ExpenseReportRow = {
  id: string;
  incurredAt: Date;
  label: string;
  category: string;
  amount: number;
};

export async function getExpensesReport(
  storeId: string,
  from: Date,
  to: Date,
): Promise<{ rows: ExpenseReportRow[]; total: number; byCategory: Record<string, number> }> {
  const expenses = await prisma.storeExpense.findMany({
    where: { storeId, incurredAt: { gte: from, lte: to } },
    orderBy: { incurredAt: 'desc' },
  });

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const expense of expenses) {
    total += expense.amount;
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + expense.amount;
  }

  return {
    rows: expenses.map((e) => ({
      id: e.id,
      incurredAt: e.incurredAt,
      label: e.label,
      category: e.category,
      amount: e.amount,
    })),
    total,
    byCategory,
  };
}

export type EmployeeReportRow = {
  userId: string;
  name: string;
  salesCount: number;
  revenue: number;
};

/**
 * Même principe que `getStoreEmployeePerformance` (analytics.ts), mais sur
 * une période en dates libres plutôt qu'un `PeriodKey` — pour rester
 * cohérent avec le filtre commun à tous les onglets de cette page.
 */
export async function getEmployeesReport(storeId: string, from: Date, to: Date): Promise<EmployeeReportRow[]> {
  const sales = await prisma.sale.groupBy({
    by: ['userId'],
    where: { storeId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' }, userId: { not: null } },
    _sum: { total: true },
    _count: true,
  });
  if (sales.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: sales.map((s) => s.userId!) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return sales
    .map((s) => ({
      userId: s.userId!,
      name: nameById.get(s.userId!) ?? 'Employé supprimé',
      salesCount: s._count,
      revenue: s._sum.total ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type TaxReportRow = { id: string; number: number; createdAt: Date; subtotal: number; taxAmount: number };

export async function getTaxReport(
  storeId: string,
  from: Date,
  to: Date,
): Promise<{ rows: TaxReportRow[]; totalTax: number }> {
  const sales = await prisma.sale.findMany({
    where: { storeId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' }, taxAmount: { gt: 0 } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true, createdAt: true, subtotal: true, taxAmount: true },
  });

  return { rows: sales, totalTax: sales.reduce((sum, s) => sum + s.taxAmount, 0) };
}
