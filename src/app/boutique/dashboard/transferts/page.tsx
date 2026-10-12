import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { ensureStoreUnitsReady, resolveVariantUnitsBulk } from '@/lib/boutique/units-engine';
import { UNIT_LABELS, isDecimalUnit } from '@/lib/boutique/units';
import { parseVariantAxes, variantLabel } from '@/lib/boutique/variants';
import { listTransferDestinations, listTransfers } from '@/lib/boutique/transfers-service';
import { PageHeader } from '@/components/ui';
import { TransfersManager, type TransferProduct } from '@/components/boutique/transfers-manager';

export const metadata: Metadata = { title: 'Transferts de stock' };
export const dynamic = 'force-dynamic';

/**
 * Transferts de stock entre les boutiques d'un même commerçant : envoyer
 * depuis la boutique ouverte, réceptionner ce qui arrive, suivre ce qui est
 * en route. Voir `transfers-service.ts`.
 */
export default async function TransfersPage() {
  const context = await requireStore('inventory:view');
  const storeId = context.store.id;
  const canSend = context.permissions.has('inventory:transfer') && !context.isSupportAccess;
  const canReceive = context.permissions.has('inventory:transfer') || context.permissions.has('inventory:manage');

  const [transfers, destinations] = await Promise.all([
    listTransfers(storeId),
    canSend ? listTransferDestinations(storeId, context.user.id) : Promise.resolve([]),
  ]);

  let products: TransferProduct[] = [];
  if (canSend && destinations.length > 0) {
    await ensureStoreUnitsReady(storeId, context.store.businessType);
    const rows = await prisma.storeProduct.findMany({
      where: { storeId, status: { not: 'ARCHIVED' } },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        unit: true,
        variantAxes: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            barcode: true,
            attributes: true,
            inventory: { where: { warehouse: { isDefault: true } }, select: { quantity: true } },
          },
        },
      },
    });
    const units = await resolveVariantUnitsBulk(rows.flatMap((row) => row.variants.map((variant) => variant.id)));
    products = rows.flatMap((row) => {
      const axes = parseVariantAxes(row.variantAxes);
      return row.variants.map((variant) => ({
        variantId: variant.id,
        name: row.name,
        variantLabel: variantLabel((variant.attributes ?? {}) as Record<string, string>, axes),
        sku: variant.sku,
        barcode: variant.barcode,
        stock: variant.inventory[0] ? toQty(variant.inventory[0].quantity) : 0,
        units: units.get(variant.id)?.map((unit) => ({
          unitId: unit.unitId,
          label: unit.label,
          labelPlural: unit.labelPlural,
          isDecimal: unit.isDecimal,
          factor: unit.factor,
          price: unit.price,
          isBase: unit.isBase,
        })) ?? [
          {
            unitId: 'base',
            label: UNIT_LABELS[row.unit] ?? 'pièce(s)',
            labelPlural: UNIT_LABELS[row.unit] ?? 'pièce(s)',
            isDecimal: isDecimalUnit(row.unit),
            factor: 1,
            price: null,
            isBase: true,
          },
        ],
      }));
    });
  }

  return (
    <>
      <PageHeader
        title="Transferts de stock"
        description="Envoyez de la marchandise d'une de vos boutiques à une autre. Le stock quitte la boutique de départ à l'envoi et entre dans l'autre à la réception."
      />
      <TransfersManager
        storeName={context.store.name}
        transfers={transfers}
        destinations={destinations.map((store) => ({ id: store.id, name: store.name }))}
        products={products}
        canSend={canSend}
        canReceive={canReceive}
      />
    </>
  );
}
