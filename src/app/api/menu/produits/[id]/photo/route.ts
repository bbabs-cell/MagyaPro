import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { productPhotoSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/**
 * Attribution rapide d'une photo à un plat, sans repasser tout le produit —
 * le geste répété par l'atelier photo lors d'un import groupé.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('menu:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'product',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(productPhotoSchema, await readJson(request));

  const product = await prisma.product.update({
    where: { id: existing.id },
    data: { imageUrl: input.imageUrl },
  });

  return ok({ product });
});
