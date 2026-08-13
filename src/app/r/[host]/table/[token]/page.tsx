import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { TableLanding } from '@/components/site/table-landing';

type Props = { params: Promise<{ host: string; token: string }> };

export const metadata: Metadata = {
  title: 'Votre table',
  robots: { index: false, follow: false },
};

export default async function TablePage({ params }: Props) {
  const { host, token } = await params;
  const restaurant = await resolvePublicRestaurant(host);
  if (!restaurant) notFound();

  const entitlements = await getEntitlements(restaurant.id);
  if (!hasFeature(entitlements, FEATURES.TABLE_SERVICE)) notFound();

  const table = await prisma.restaurantTable.findFirst({
    where: { token, restaurantId: restaurant.id },
    select: { label: true },
  });
  if (!table) notFound();

  return (
    <div className="container-page max-w-xl py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Bienvenue — {table.label}
      </h1>
      <p className="mt-2 text-ink-muted">{restaurant.name}</p>

      <div className="mt-8">
        <TableLanding
          host={host}
          restaurantId={restaurant.id}
          token={token}
          tableLabel={table.label}
          orderingEnabled={restaurant.settings?.tableOrderingEnabled ?? false}
        />
      </div>
    </div>
  );
}
