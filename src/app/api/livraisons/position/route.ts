import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Position GPS du livreur, envoyée périodiquement depuis son téléphone
 * tant qu'il a une livraison en cours. Met à jour toutes ses courses
 * actives d'un coup — un livreur porte rarement plus d'une commande à la
 * fois, mais rien n'empêche techniquement d'en avoir plusieurs.
 */
export const POST = route(async (request) => {
  const { restaurant, user } = await requireTenant('deliveries:drive');
  const input = parseOrThrow(schema, await readJson(request));

  await prisma.order.updateMany({
    where: {
      restaurantId: restaurant.id,
      courierId: user.id,
      status: 'OUT_FOR_DELIVERY',
    },
    data: {
      courierLat: input.lat,
      courierLng: input.lng,
      courierLocationUpdatedAt: new Date(),
    },
  });

  return ok({ updated: true });
});
