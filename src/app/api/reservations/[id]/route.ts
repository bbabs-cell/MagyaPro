import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { reservationStatusSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('reservations:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'reservation',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(reservationStatusSchema, await readJson(request));

  const reservation = await prisma.reservation.update({
    where: { id: existing.id },
    data: { status: input.status },
  });

  return ok({ reservation });
});
