import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { galleryCaptionSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('restaurant:update');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>('galleryImage', context.restaurant.id, id);
  const input = parseOrThrow(galleryCaptionSchema, await readJson(request));

  const image = await prisma.galleryImage.update({
    where: { id: existing.id },
    data: { caption: input.caption ?? null },
  });

  return ok({ image });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('restaurant:update');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>('galleryImage', context.restaurant.id, id);
  await prisma.galleryImage.delete({ where: { id: existing.id } });

  return ok({ deleted: true });
});
