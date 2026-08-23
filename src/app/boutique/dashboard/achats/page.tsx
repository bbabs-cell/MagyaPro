import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { PageHeader } from '@/components/ui';
import { PurchasesManager } from '@/components/boutique/purchases-manager';

export const metadata: Metadata = { title: 'Achats' };
export const dynamic = 'force-dynamic';

export default async function BoutiquePurchasesPage() {
  const context = await requireStore('purchases:view');

  const [suppliers, variants, orders] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId: context.store.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, debtBalance: true },
    }),
    prisma.storeProductVariant.findMany({
      where: { product: { storeId: context.store.id } },
      select: { id: true, product: { select: { name: true } } },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.purchaseOrder.findMany({
      where: { storeId: context.store.id },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { name: true } },
        items: { select: { id: true, quantityOrdered: true, quantityReceived: true, unitCost: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader title="Achats" description="Fournisseurs et réapprovisionnement du stock." />
      <PurchasesManager
        initialSuppliers={suppliers}
        initialProducts={variants.map((v) => ({ variantId: v.id, name: v.product.name }))}
        initialOrders={orders.map((order) => ({
          ...order,
          items: order.items.map((item) => ({
            ...item,
            quantityOrdered: toQty(item.quantityOrdered),
            quantityReceived: toQty(item.quantityReceived),
          })),
        }))}
        currency={context.store.currency}
        canManage={context.permissions.has('purchases:manage')}
      />
    </>
  );
}
