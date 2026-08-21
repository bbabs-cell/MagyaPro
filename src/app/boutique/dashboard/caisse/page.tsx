import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader, EmptyState, LinkButton } from '@/components/ui';
import { Pos } from '@/components/boutique/pos';

export const metadata: Metadata = { title: 'Caisse' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueCaissePage() {
  const context = await requireStore('pos:access');

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { storeId: context.store.id, isDefault: true },
    select: { id: true },
  });

  const customers = await prisma.storeCustomer.findMany({
    where: { storeId: context.store.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true, creditBalance: true, creditLimit: true },
  });

  const variants = await prisma.storeProductVariant.findMany({
    where: { product: { storeId: context.store.id, status: 'ACTIVE' }, isActive: true },
    select: {
      id: true,
      price: true,
      product: { select: { name: true } },
      inventory: defaultWarehouse
        ? { where: { warehouseId: defaultWarehouse.id }, select: { quantity: true } }
        : false,
    },
    orderBy: { product: { name: 'asc' } },
  });

  const products = variants.map((variant) => ({
    id: variant.id,
    variantId: variant.id,
    name: variant.product.name,
    price: variant.price,
    stock: variant.inventory?.[0]?.quantity ?? 0,
  }));

  return (
    <>
      <PageHeader title="Caisse" description="Enregistrez une vente." />

      {products.length === 0 ? (
        <EmptyState
          title="Aucun produit actif"
          description="Créez et activez au moins un produit pour pouvoir vendre."
          action={
            <LinkButton href="/boutique/dashboard/produits" size="sm">
              Gérer les produits
            </LinkButton>
          }
        />
      ) : (
        <Pos products={products} customers={customers} currency={context.store.currency} />
      )}
    </>
  );
}
