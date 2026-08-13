import { headers } from 'next/headers';
import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { reviewSchema } from '@/lib/validation';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const schema = reviewSchema.extend({ restaurantId: z.string().min(1) });

/**
 * Dépôt d'un avis client depuis le site public.
 *
 * Rattacher l'avis à une commande n'est pas obligatoire, mais quand c'est le
 * cas la commande doit appartenir au restaurant visé, être terminée, et ne pas
 * avoir déjà reçu d'avis — la contrainte d'unicité sur `orderId` l'empêche
 * aussi côté base. Tout avis part `PENDING` : rien n'est publié sans
 * modération du restaurant.
 */
export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  const input = parseOrThrow(schema, await readJson(request));

  hit(`review:ip:${ip}`, RATE_LIMITS.checkout);

  const restaurant = await prisma.restaurant.findFirst({
    where: { id: input.restaurantId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  const entitlements = await getEntitlements(restaurant.id);
  requireFeature(entitlements, FEATURES.REVIEWS);

  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, restaurantId: restaurant.id },
      select: { id: true, status: true, review: { select: { id: true } } },
    });
    if (!order) throw new NotFoundError('Commande introuvable.');
    if (order.status !== 'COMPLETED') {
      throw new ValidationError(
        "Cette commande n'est pas encore terminée : l'avis ne peut pas être laissé maintenant.",
      );
    }
    if (order.review) {
      throw new ConflictError('Un avis a déjà été laissé pour cette commande.');
    }
  }

  const review = await prisma.review.create({
    data: {
      restaurantId: restaurant.id,
      orderId: input.orderId ?? null,
      customerName: input.customerName,
      rating: input.rating,
      comment: input.comment ?? null,
    },
  });

  return ok({ review: { id: review.id, status: review.status } }, 201);
});
