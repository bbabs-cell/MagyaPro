import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { promotionSchema } from '@/lib/validation';
import { ConflictError } from '@/lib/errors';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('promotions:manage');
  const promotions = await prisma.promotion.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: 'desc' },
  });
  return ok({ promotions });
});

export const POST = route(async (request) => {
  const context = await requireTenant('promotions:manage');

  // Fonctionnalité soumise au plan : le contrôle est ici, côté serveur, pas
  // seulement dans l'affichage du bouton.
  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.PROMOTIONS);

  const input = parseOrThrow(promotionSchema, await readJson(request));

  const duplicate = await prisma.promotion.findUnique({
    where: {
      restaurantId_code: { restaurantId: context.restaurant.id, code: input.code },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError('Un code promo identique existe déjà.');
  }

  const promotion = await prisma.promotion.create({
    data: {
      restaurantId: context.restaurant.id,
      code: input.code,
      type: input.type,
      value: input.value,
      minOrder: input.minOrder,
      maxRedemptions: input.maxRedemptions ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive,
    },
  });

  return ok({ promotion }, 201);
});
