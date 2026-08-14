import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { galleryImageSchema } from '@/lib/validation';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('restaurant:update');
  const images = await prisma.galleryImage.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { position: 'asc' },
  });
  return ok({ images });
});

export const POST = route(async (request) => {
  const context = await requireTenant('restaurant:update');
  const input = parseOrThrow(galleryImageSchema, await readJson(request));

  const last = await prisma.galleryImage.findFirst({
    where: { restaurantId: context.restaurant.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const image = await prisma.galleryImage.create({
    data: {
      restaurantId: context.restaurant.id,
      imageUrl: input.imageUrl,
      caption: input.caption ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });

  return ok({ image }, 201);
});
