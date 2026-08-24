import { headers } from 'next/headers';
import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { reservationSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';
import { generateReservationCode } from '@/lib/reservations';
import { notifyNewReservation } from '@/lib/notifications';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const schema = reservationSchema.extend({ restaurantId: z.string().min(1) });

/**
 * Réservation de table depuis le site public.
 *
 * La réservation est créée `PENDING` : c'est le restaurant qui la confirme
 * depuis le back-office. Aucune table n'est bloquée automatiquement — la
 * plateforme ne modélise pas encore la capacité de salle.
 */
export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  const input = parseOrThrow(schema, await readJson(request));

  await hit(`reservation:ip:${ip}`, RATE_LIMITS.checkout);
  await hit(`reservation:phone:${input.customerPhone}`, RATE_LIMITS.checkout);

  const restaurant = await prisma.restaurant.findFirst({
    where: { id: input.restaurantId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  const entitlements = await getEntitlements(restaurant.id);
  requireFeature(entitlements, FEATURES.RESERVATIONS);

  // La collision de code à 6 chiffres est rare mais pas impossible ; quelques
  // essais suffisent, la contrainte d'unicité en base est le vrai garde-fou.
  let reservation = null;
  for (let attempt = 0; attempt < 5 && !reservation; attempt++) {
    try {
      reservation = await prisma.reservation.create({
        data: {
          restaurantId: restaurant.id,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          partySize: input.partySize,
          reservedFor: input.reservedFor,
          notes: input.notes ?? null,
          confirmationCode: generateReservationCode(),
        },
      });
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }

  await notifyNewReservation(
    restaurant.id,
    reservation!.id,
    reservation!.customerName,
    reservation!.partySize,
    reservation!.reservedFor,
  );

  return ok(
    {
      reservation: {
        id: reservation!.id,
        confirmationCode: reservation!.confirmationCode,
        status: reservation!.status,
        reservedFor: reservation!.reservedFor,
      },
    },
    201,
  );
});
