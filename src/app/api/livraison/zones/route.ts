import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { deliveryZoneSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('delivery:manage');
  const zones = await prisma.deliveryZone.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { position: 'asc' },
  });
  return ok({ zones });
});

export const POST = route(async (request) => {
  const context = await requireTenant('delivery:manage');
  const input = parseOrThrow(deliveryZoneSchema, await readJson(request));

  // Une livraison offerte au-dessous du minimum de commande ne serait jamais
  // atteignable : la règle serait inopérante et incompréhensible.
  if (input.freeAbove != null && input.freeAbove < input.minOrder) {
    throw new ValidationError(
      'Le seuil de livraison offerte doit être supérieur au minimum de commande.',
      { freeAbove: 'Seuil incohérent avec le minimum de commande.' },
    );
  }

  const last = await prisma.deliveryZone.findFirst({
    where: { restaurantId: context.restaurant.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const zone = await prisma.deliveryZone.create({
    data: {
      restaurantId: context.restaurant.id,
      name: input.name,
      fee: input.fee,
      minOrder: input.minOrder,
      freeAbove: input.freeAbove ?? null,
      isActive: input.isActive,
      position: (last?.position ?? -1) + 1,
    },
  });

  return ok({ zone }, 201);
});
