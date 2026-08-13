import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { PhotoWorkshop } from '@/components/dashboard/photo-workshop';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Atelier photo' };
export const dynamic = 'force-dynamic';

export default async function PhotoWorkshopPage() {
  const context = await requireTenant('menu:manage');

  const products = await prisma.product.findMany({
    where: { restaurantId: context.restaurant.id, imageUrl: null },
    orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }],
    select: { id: true, name: true, category: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Atelier photo"
        description="Déposez plusieurs photos d'un coup : elles sont attribuées automatiquement, dans l'ordre, aux plats qui n'en ont pas encore."
      />
      <PhotoWorkshop
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          categoryName: product.category.name,
        }))}
      />
    </>
  );
}
