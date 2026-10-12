import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { ensureStoreUnitsReady, resolveVariantUnitsBulk } from '@/lib/boutique/units-engine';
import { UNIT_LABELS, isDecimalUnit } from '@/lib/boutique/units';
import { parseVariantAxes, variantLabel } from '@/lib/boutique/variants';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { StockCount, type CountItem } from '@/components/boutique/stock-count';

export const metadata: Metadata = { title: 'Inventaire' };
export const dynamic = 'force-dynamic';

/**
 * Inventaire guidé : compter rayon par rayon, voir les écarts, corriger le
 * stock en une fois.
 *
 * Jusqu'ici, recaler le stock sur la réalité voulait dire ouvrir chaque fiche
 * produit et faire un retrait « Correction d'inventaire » — sans jamais voir
 * l'ensemble ni ce que les écarts coûtaient. C'est pourtant le geste qui rend
 * tous les autres chiffres crédibles : ruptures à venir, marges, valeur du
 * stock ne valent que ce que vaut le stock enregistré.
 */
export default async function StockCountPage() {
  const context = await requireStore('inventory:manage');
  const storeId = context.store.id;

  await ensureStoreUnitsReady(storeId, context.store.businessType);

  const [categories, products, lastCount] = await Promise.all([
    prisma.storeCategory.findMany({
      where: { storeId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.storeProduct.findMany({
      where: { storeId, status: { not: 'ARCHIVED' } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        categoryId: true,
        unit: true,
        variantAxes: true,
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            sku: true,
            barcode: true,
            cost: true,
            attributes: true,
            inventory: { where: { warehouse: { isDefault: true } }, select: { quantity: true } },
          },
        },
      },
    }),
    prisma.inventoryMovement.findFirst({
      where: { storeId, referenceType: 'stock_count' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const unitsByVariant = await resolveVariantUnitsBulk(
    products.flatMap((product) => product.variants.map((variant) => variant.id)),
  );

  const items: CountItem[] = products.flatMap((product) => {
    const axes = parseVariantAxes(product.variantAxes);
    return product.variants.map((variant) => {
      const resolved = unitsByVariant.get(variant.id);
      // Fiche antérieure au moteur d'unités : on compte dans son unité héritée.
      const units = resolved
        ? resolved.map((unit) => ({
            unitId: unit.unitId,
            label: unit.label,
            labelPlural: unit.labelPlural,
            isDecimal: unit.isDecimal,
            factor: unit.factor,
            price: unit.price,
            isBase: unit.isBase,
          }))
        : [
            {
              unitId: 'base',
              label: UNIT_LABELS[product.unit] ?? 'pièce(s)',
              labelPlural: UNIT_LABELS[product.unit] ?? 'pièce(s)',
              isDecimal: isDecimalUnit(product.unit),
              factor: 1,
              price: null,
              isBase: true,
            },
          ];
      return {
        variantId: variant.id,
        productName: product.name,
        variantLabel: variantLabel((variant.attributes ?? {}) as Record<string, string>, axes),
        categoryId: product.categoryId,
        sku: variant.sku,
        barcode: variant.barcode,
        stock: variant.inventory[0] ? toQty(variant.inventory[0].quantity) : 0,
        unitCost: variant.cost,
        units,
      };
    });
  });

  return (
    <>
      <PageHeader
        title="Inventaire"
        description="Comptez ce qu'il y a vraiment en rayon. Les écarts sont corrigés en une fois, avec leur valeur, et restent dans l'historique."
      />
      {items.length === 0 ? (
        <EmptyState
          title="Aucun produit à compter"
          description="Ajoutez d'abord vos produits : l'inventaire se fait sur votre catalogue."
          action={<LinkButton href="/boutique/dashboard/produits">Ajouter des produits</LinkButton>}
        />
      ) : (
        <StockCount
          storeId={storeId}
          categories={categories}
          items={items}
          currency={context.store.currency}
          lastCountAt={lastCount?.createdAt.toISOString() ?? null}
        />
      )}
    </>
  );
}
