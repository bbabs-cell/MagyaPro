import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { ensureStoreUnitsReady } from '@/lib/boutique/units-engine';
import { loadEarliestExpiry } from '@/lib/boutique/expiry-load';
import { parseVariantAxes } from '@/lib/boutique/variants';
import { PageHeader } from '@/components/ui';
import { ProductManager } from '@/components/boutique/product-manager';
import { ExcelImportExport } from '@/components/boutique/excel-import-export';

export const metadata: Metadata = { title: 'Produits' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueProductsPage() {
  const context = await requireStore('products:view');

  // Reprise paresseuse : sème les unités de la boutique et convertit les
  // fiches antérieures au moteur d'unités. Ne fait un vrai travail qu'au tout
  // premier passage (voir `ensureStoreUnitsReady`).
  await ensureStoreUnitsReady(context.store.id, context.store.businessType);

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
            isActive: true,
            attributes: true,
            units: {
              orderBy: { position: 'asc' },
              select: {
                unitId: true,
                factor: true,
                price: true,
                cost: true,
                isSellable: true,
                isPurchasable: true,
              },
            },
            inventory: { select: { quantity: true, warehouseId: true } },
          },
        },
      },
    }),
  ]);

  // Date de péremption la plus proche par déclinaison — une seule requête
  // groupée pour tout le catalogue (voir `loadEarliestExpiry`).
  const expiryByVariant = await loadEarliestExpiry(context.store.id);

  const storeUnits = await prisma.storeUnit.findMany({
    where: { storeId: context.store.id, isActive: true },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      code: true,
      label: true,
      labelPlural: true,
      isDecimal: true,
      defaultFactor: true,
    },
  });

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
          maxStock: product.maxStock ? toQty(product.maxStock) : null,
          variantAxes: parseVariantAxes(product.variantAxes),
          variants: product.variants.map((variant) => ({
            ...variant,
            attributes: (variant.attributes ?? {}) as Record<string, string>,
            // Sérialisée : le composant qui la lit s'exécute côté navigateur,
            // où un objet Date ne traverse pas la frontière serveur/client.
            expiryDate: expiryByVariant.get(variant.id)?.toISOString() ?? null,
            units: variant.units.map((unit) => ({ ...unit, factor: toQty(unit.factor) })),
            inventory: variant.inventory.map((inv) => ({
              ...inv,
              quantity: toQty(inv.quantity),
            })),
          })),
        }))}
        // Instant de référence figé côté serveur : sans lui, le serveur et le
        // navigateur calculeraient « périme dans N jours » à deux instants
        // différents, ce que React signale comme une erreur d'hydratation.
        now={Date.now()}
        storeUnits={storeUnits.map((unit) => ({
          ...unit,
          labelPlural: unit.labelPlural ?? unit.label,
          defaultFactor: unit.defaultFactor ? toQty(unit.defaultFactor) : null,
        }))}
        currency={context.store.currency}
        canManage={context.permissions.has('products:manage')}
        businessType={context.store.businessType}
      />
    </>
  );
}
