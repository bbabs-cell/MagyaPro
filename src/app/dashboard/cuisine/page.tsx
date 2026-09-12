import type { Metadata } from 'next';

import { requireTenant } from '@/lib/tenant';
import { listKitchenOrders } from '@/lib/kitchen';
import { KitchenBoard } from '@/components/dashboard/kitchen-board';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Cuisine' };
export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const { restaurant } = await requireTenant('orders:update_status');
  const orders = await listKitchenOrders(restaurant.id);

  return (
    <>
      <PageHeader
        title="Cuisine"
        description="Commandes confirmées, dans l'ordre d'arrivée. Les plus anciennes d'abord."
      />
      <KitchenBoard initialOrders={orders} />
    </>
  );
}
