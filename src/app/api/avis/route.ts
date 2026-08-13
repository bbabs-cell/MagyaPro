import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('reviews:moderate');

  const reviews = await prisma.review.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { number: true } } },
  });

  return ok({ reviews });
});
