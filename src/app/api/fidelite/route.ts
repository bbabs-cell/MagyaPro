import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { loyaltyTierSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('loyalty:manage');
  const tiers = await prisma.loyaltyTier.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { thresholdSpent: 'asc' },
  });
  return ok({ tiers });
});

export const POST = route(async (request) => {
  const context = await requireTenant('loyalty:manage');

  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.LOYALTY);

  const input = parseOrThrow(loyaltyTierSchema, await readJson(request));

  const last = await prisma.loyaltyTier.findFirst({
    where: { restaurantId: context.restaurant.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const tier = await prisma.loyaltyTier.create({
    data: {
      restaurantId: context.restaurant.id,
      name: input.name,
      thresholdSpent: input.thresholdSpent,
      rewardType: input.rewardType,
      rewardValue: input.rewardValue,
      isActive: input.isActive,
      position: (last?.position ?? -1) + 1,
    },
  });

  return ok({ tier }, 201);
});
