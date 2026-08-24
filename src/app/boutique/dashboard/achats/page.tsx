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

  const [suppliers, variants, orders, warehouses] = await Promise.all([
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
        supplier: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityReceived: true,
            unitCost: true,
            discount: true,
            productVariant: { select: { product: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.warehouse.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Achats" description="Fournisseurs et réapprovisionnement du stock." />
      <PurchasesManager
        initialSuppliers={suppliers}
        initialProducts={variants.map((v) => ({ variantId: v.id, name: v.product.name }))}
        initialOrders={orders.map((order) => ({
          id: order.id,
          reference: order.reference,
          status: order.status,
          extraFees: order.extraFees,
          expectedAt: order.expectedAt?.toISOString() ?? null,
          supplier: order.supplier,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productVariant.product.name,
            quantityOrdered: toQty(item.quantityOrdered),
            quantityReceived: toQty(item.quantityReceived),
            unitCost: item.unitCost,
            discount: item.discount,
          })),
        }))}
        warehouses={warehouses}
        currency={context.store.currency}
        canManage={context.permissions.has('purchases:manage')}
      />
    </>
  );
}
