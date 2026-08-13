import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { reservationSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';
import { generateReservationCode } from '@/lib/reservations';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('reservations:manage');

  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { reservedFor: 'asc' },
  });

  return ok({ reservations });
});

/** Réservation prise directement par le personnel (téléphone, sur place). */
export const POST = route(async (request) => {
  const context = await requireTenant('reservations:manage');

  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.RESERVATIONS);

  const input = parseOrThrow(reservationSchema, await readJson(request));

  let reservation = null;
  for (let attempt = 0; attempt < 5 && !reservation; attempt++) {
    try {
      reservation = await prisma.reservation.create({
        data: {
          restaurantId: context.restaurant.id,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          partySize: input.partySize,
          reservedFor: input.reservedFor,
          notes: input.notes ?? null,
          status: 'CONFIRMED',
          confirmationCode: generateReservationCode(),
        },
      });
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }

  return ok({ reservation }, 201);
});
