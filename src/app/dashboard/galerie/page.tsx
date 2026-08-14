import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { GalleryManager } from '@/components/dashboard/gallery-manager';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Galerie' };
export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const context = await requireTenant('restaurant:update');

  const images = await prisma.galleryImage.findMany({
    where: { restaurantId: context.restaurant.id },
    orderBy: { position: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Galerie"
        description="Photos du restaurant, du chef, de l'équipe — affichées sur votre page Informations."
      />
      <GalleryManager
        images={images.map((image) => ({ id: image.id, imageUrl: image.imageUrl, caption: image.caption }))}
      />
    </>
  );
}
