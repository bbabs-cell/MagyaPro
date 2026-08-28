import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { PageHeader } from '@/components/ui';
import { ensureStoreUnitsReady, resolveVariantUnitsBulk } from '@/lib/boutique/units-engine';
import { forecastStock } from '@/lib/boutique/stock-forecast';
import { loadSalesVelocity } from '@/lib/boutique/stock-velocity';
import { StockForecastTable, type ForecastRow } from '@/components/boutique/stock-forecast-table';

export const metadata: Metadata = { title: 'Prévisions' };
export const dynamic = 'force-dynamic';

/**
 * Prévision des ruptures — « ce qui risque de manquer, et combien commander ».
 *
 * Les déclinaisons d'un même produit sont agrégées : un t-shirt en rupture de
 * taille M n'est pas en rupture, et le commerçant raisonne par produit quand
 * il passe commande. Le détail par taille reste sur la fiche produit.
 */
export default async function BoutiqueForecastPage() {
  const context = await requireStore('inventory:view');
  await ensureStoreUnitsReady(context.store.id, context.store.businessType);

  const [products, velocity] = await Promise.all([
    prisma.storeProduct.findMany({
      where: { storeId: context.store.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        minStockAlert: true,
        maxStock: true,
        supplierLeadDays: true,
        variants: {
          where: { isActive: true },
          select: { id: true, inventory: { select: { quantity: true } } },
        },
      },
    }),
    loadSalesVelocity(context.store.id),
  ]);

  const unitsByVariant = await resolveVariantUnitsBulk(
    products.flatMap((product) => product.variants.map((variant) => variant.id)),
  );

  const rows: ForecastRow[] = products
    .filter((product) => product.variants.length > 0)
    .map((product) => {
      const stock = product.variants.reduce(
        (sum, variant) =>
          sum + variant.inventory.reduce((vSum, inv) => vSum + toQty(inv.quantity), 0),
        0,
      );
      const stats = product.variants.reduce(
        (acc, variant) => {
          const entry = velocity.get(variant.id);
          if (!entry) return acc;
          return {
            daily: acc.daily + entry.daily,
            observedDays: Math.max(acc.observedDays, entry.observedDays),
            reliable: acc.reliable || entry.reliable,
          };
        },
        { daily: 0, observedDays: 0, reliable: false },
      );

      const forecast = forecastStock({
        stock,
        dailySales: stats.daily,
        minStockAlert: toQty(product.minStockAlert),
        supplierLeadDays: product.supplierLeadDays,
        maxStock: product.maxStock ? toQty(product.maxStock) : null,
        observedDays: stats.observedDays,
        reliable: stats.reliable,
      });

      return {
        productId: product.id,
        name: product.name,
        level: forecast.level,
        stock: forecast.stock,
        dailySales: forecast.dailySales,
        daysLeft: forecast.daysLeft,
        recommendedQuantity: forecast.recommendedQuantity,
        reliable: forecast.reliable,
        units: (unitsByVariant.get(product.variants[0]!.id) ?? []).map((unit) => ({
          unitId: unit.unitId,
          label: unit.label,
          labelPlural: unit.labelPlural,
          isDecimal: unit.isDecimal,
          factor: unit.factor,
          price: unit.price,
          isBase: unit.isBase,
        })),
      };
    });

  return (
    <>
      <PageHeader
        title="Prévisions"
        description="Ce qui risque de manquer, et quand — d'après vos ventes réelles."
      />
      <StockForecastTable rows={rows} baseUnitLabel="" />
    </>
  );
}
