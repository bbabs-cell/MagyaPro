import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { loyaltyTierSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('loyalty:manage');
  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.LOYALTY);

  const { id } = await params;
  const existing = await findScopedOrThrow<{ id: string }>(
    'loyaltyTier',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(loyaltyTierSchema, await readJson(request));

  const tier = await prisma.loyaltyTier.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      thresholdSpent: input.thresholdSpent,
      rewardType: input.rewardType,
      rewardValue: input.rewardValue,
      isActive: input.isActive,
    },
  });

  return ok({ tier });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('loyalty:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'loyaltyTier',
    context.restaurant.id,
    id,
  );

  await prisma.loyaltyTier.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
