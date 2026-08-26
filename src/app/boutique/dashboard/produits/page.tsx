import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { PageHeader } from '@/components/ui';
import { ProductManager } from '@/components/boutique/product-manager';
import { ExcelImportExport } from '@/components/boutique/excel-import-export';

export const metadata: Metadata = { title: 'Produits' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueProductsPage() {
  const context = await requireStore('products:view');

  const [categories, brands, products] = await Promise.all([
    prisma.storeCategory.findMany({
      where: { storeId: context.store.id },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, _count: { select: { products: true } } },
    }),
    prisma.brand.findMany({
      where: { storeId: context.store.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { products: true } } },
    }),
    prisma.storeProduct.findMany({
      where: { storeId: context.store.id },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            cost: true,
            price: true,
            packSize: true,
            packCost: true,
            packPrice: true,
            attributes: true,
            inventory: { select: { quantity: true, warehouseId: true } },
          },
        },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Produits"
        description="Votre catalogue et le suivi de votre stock."
      />
      <ExcelImportExport canImport={context.permissions.has('products:manage')} />
      <ProductManager
        initialCategories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          productCount: c._count.products,
        }))}
        initialBrands={brands.map((b) => ({
          id: b.id,
          name: b.name,
          productCount: b._count.products,
        }))}
        initialProducts={products.map((product) => ({
          ...product,
          minStockAlert: toQty(product.minStockAlert),
          variants: product.variants.map((variant) => ({
            ...variant,
            attributes: (variant.attributes ?? {}) as Record<string, string>,
            inventory: variant.inventory.map((inv) => ({
              ...inv,
              quantity: toQty(inv.quantity),
            })),
          })),
        }))}
        currency={context.store.currency}
        canManage={context.permissions.has('products:manage')}
        businessType={context.store.businessType}
      />
    </>
  );
}
