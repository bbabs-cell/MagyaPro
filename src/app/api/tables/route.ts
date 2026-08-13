import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { tableSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('tables:view');

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { position: 'asc' },
  });

  return ok({ tables });
});

export const POST = route(async (request) => {
  const context = await requireTenant('tables:manage');

  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.TABLE_SERVICE);

  const input = parseOrThrow(tableSchema, await readJson(request));

  const last = await prisma.restaurantTable.findFirst({
    where: { restaurantId: context.restaurant.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const table = await prisma.restaurantTable.create({
    data: {
      restaurantId: context.restaurant.id,
      label: input.label,
      position: (last?.position ?? -1) + 1,
    },
  });

  return ok({ table }, 201);
});
