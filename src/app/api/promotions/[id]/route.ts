import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { promotionSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('promotions:manage');
  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.PROMOTIONS);

  const { id } = await params;
  const existing = await findScopedOrThrow<{ id: string }>(
    'promotion',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(promotionSchema, await readJson(request));

  const promotion = await prisma.promotion.update({
    where: { id: existing.id },
    data: {
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

  return ok({ promotion });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('promotions:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'promotion',
    context.restaurant.id,
    id,
  );

  await prisma.promotion.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
