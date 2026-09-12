import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { DeliverySettings } from '@/components/dashboard/delivery-settings';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Zones et frais de livraison' };
export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  const context = await requireTenant('delivery:manage');

  const [zones, settings] = await Promise.all([
    prisma.deliveryZone.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { position: 'asc' },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: context.restaurant.id },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Zones et frais de livraison"
        description="Définissez vos zones, vos frais et vos conditions de livraison."
      />

      <DeliverySettings
        currency={context.restaurant.currency}
        deliveryEnabled={settings?.deliveryEnabled ?? true}
        pickupEnabled={settings?.pickupEnabled ?? true}
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          fee: zone.fee,
          minOrder: zone.minOrder,
          freeAbove: zone.freeAbove,
          isActive: zone.isActive,
        }))}
      />
    </>
  );
}
