import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { markNotificationRead } from '@/lib/notifications';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (_request, { params }: Params) => {
  const { restaurant } = await requireTenant('tables:view');
  const { id } = await params;

  await markNotificationRead(restaurant.id, id);
  const notification = await prisma.notification.findFirst({ where: { id, restaurantId: restaurant.id } });

  return ok({ notification });
});
