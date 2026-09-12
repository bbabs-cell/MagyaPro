import type { Metadata } from 'next';

import { requireTenant } from '@/lib/tenant';
import { listCourierDeliveries } from '@/lib/deliveries';
import { DeliveryBoard } from '@/components/dashboard/delivery-board';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Mes livraisons' };
export const dynamic = 'force-dynamic';

export default async function DeliveriesPage() {
  const { restaurant, user } = await requireTenant('deliveries:drive');
  const { pool, mine } = await listCourierDeliveries({
    restaurantId: restaurant.id,
    courierId: user.id,
  });

  return (
    <>
      <PageHeader
        title="Mes livraisons"
        description="Prenez une course, appelez le client, encaissez, et confirmez la remise avec le code que le client vous donne."
      />
      <DeliveryBoard initialPool={pool} initialMine={mine} />
    </>
  );
}
