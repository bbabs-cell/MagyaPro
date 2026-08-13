import { z } from 'zod';

import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { trackEvent } from '@/lib/analytics';

const schema = z.object({
  restaurantId: z.string().min(1).max(40),
  type: z.enum(['PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED']),
  path: z.string().max(300).optional(),
  visitorId: z.string().max(64).nullable().optional(),
});

/**
 * Collecte des événements d'audience du site public.
 *
 * Route non authentifiée : elle répond toujours 200, même sur données
 * invalides. Une mesure ratée ne doit jamais provoquer d'erreur visible chez
 * le visiteur, et un 4xx renverrait au client des informations sur la
 * structure attendue sans aucun bénéfice.
 */
export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (parsed.success) {
    // Le restaurant doit exister et être en ligne : sans ce contrôle, la route
    // permettrait d'insérer des lignes pour des identifiants arbitraires.
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: parsed.data.restaurantId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (restaurant) {
      await trackEvent({
        restaurantId: restaurant.id,
        type: parsed.data.type,
        path: parsed.data.path,
        visitorId: parsed.data.visitorId ?? null,
      });
    }
  }

  return ok({ received: true });
});
