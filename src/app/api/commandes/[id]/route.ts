import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { orderStatusSchema } from '@/lib/validation';
import { updateOrderStatus } from '@/lib/orders/service';
import { currentClientIp } from '@/lib/auth/session';

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (_request, { params }: Params) => {
  const context = await requireTenant('orders:view');
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, restaurantId: context.restaurant.id },
    include: {
      items: true,
      customer: true,
      deliveryZone: true,
      payments: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) throw new NotFoundError('Commande introuvable.');

  return ok({ order });
});

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('orders:update_status');
  const { id } = await params;
  const input = parseOrThrow(orderStatusSchema, await readJson(request));

  // L'annulation est une permission distincte du simple avancement de statut :
  // un employé fait avancer une commande, il ne l'annule pas.
  if (input.status === 'CANCELLED' && !context.permissions.has('orders:cancel')) {
    throw new ForbiddenError("Vous n'avez pas le droit d'annuler une commande.");
  }

  const order = await updateOrderStatus({
    restaurantId: context.restaurant.id,
    orderId: id,
    status: input.status,
    userId: context.user.id,
    actorEmail: context.user.email,
    note: input.note ?? null,
    ip: await currentClientIp(),
  });

  return ok({ order });
});
