import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { cartItemSchema } from '@/lib/validation';
import { priceOrder } from '@/lib/orders/pricing';

const schema = z.object({
  restaurantId: z.string().min(1),
  items: z.array(cartItemSchema).min(1).max(50),
  fulfillmentType: z.enum(['DELIVERY', 'PICKUP']),
  deliveryZoneId: z.string().min(1).nullable().optional(),
  promoCode: z.string().trim().toUpperCase().max(24).optional(),
});

/**
 * Chiffrage du panier avant validation.
 *
 * Route publique : elle sert le tunnel de commande, où le client n'est pas
 * authentifié. Le `restaurantId` est ici légitime dans le corps de la requête —
 * il désigne la boutique consultée, pas un tenant auquel on donnerait accès —
 * et il n'ouvre aucun droit : le calcul ne lit que des données déjà publiques
 * (prix affichés, frais de zone) d'un restaurant en ligne.
 *
 * Le total renvoyé ici est indicatif ; celui qui engage est recalculé à la
 * création de la commande.
 */
export const POST = route(async (request) => {
  const input = parseOrThrow(schema, await readJson(request));

  const restaurant = await prisma.restaurant.findFirst({
    where: { id: input.restaurantId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  const priced = await priceOrder(prisma, {
    restaurantId: restaurant.id,
    items: input.items,
    fulfillmentType: input.fulfillmentType,
    deliveryZoneId: input.deliveryZoneId,
    promoCode: input.promoCode,
  });

  return ok({
    subtotal: priced.subtotal,
    discount: priced.discount,
    deliveryFee: priced.deliveryFee,
    total: priced.total,
    currency: priced.currency,
    promoCode: priced.promoCode,
    items: priced.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  });
});
