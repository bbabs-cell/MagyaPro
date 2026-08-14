import { z } from 'zod';
import { headers } from 'next/headers';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { checkoutSchema } from '@/lib/validation';
import { createOrder } from '@/lib/orders/service';
import { initiatePayment } from '@/lib/payments/service';
import { availableProvidersFor } from '@/lib/payments/registry';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { trackEvent } from '@/lib/analytics';
import { env } from '@/lib/env';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

const schema = checkoutSchema.extend({ restaurantId: z.string().min(1) });

/**
 * Création d'une commande depuis le site public.
 *
 * Aucun montant n'est accepté du client : le corps ne contient que des
 * identifiants de produits, des quantités et les coordonnées de livraison.
 * `createOrder` recalcule l'intégralité des montants dans sa transaction.
 */
export const POST = route(async (request) => {
  const ip = clientIp(await headers()) ?? 'inconnu';
  const input = parseOrThrow(schema, await readJson(request));

  // Deux compteurs : par IP, et par numéro de téléphone — sans quoi un même
  // client pourrait saturer un restaurant depuis plusieurs connexions.
  hit(`checkout:ip:${ip}`, RATE_LIMITS.checkout);
  hit(`checkout:phone:${input.customerPhone}`, RATE_LIMITS.checkout);

  const restaurant = await prisma.restaurant.findFirst({
    where: { id: input.restaurantId, status: 'ACTIVE' },
    select: { id: true, slug: true, currency: true, settings: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');

  // Une commande « sur place » doit venir d'une table réelle du restaurant,
  // et le service à table doit être à la fois inclus dans le plan et activé
  // par le restaurant — deux garde-fous indépendants, comme pour les autres
  // options soumises au plan.
  let tableId: string | null = null;
  if (input.fulfillmentType === 'DINE_IN') {
    if (!input.tableToken) {
      throw new ValidationError('Table introuvable.');
    }
    const entitlements = await getEntitlements(restaurant.id);
    requireFeature(entitlements, FEATURES.TABLE_SERVICE);
    if (!restaurant.settings?.tableOrderingEnabled) {
      throw new ValidationError('La commande depuis la table est désactivée.');
    }
    const table = await prisma.restaurantTable.findFirst({
      where: { token: input.tableToken, restaurantId: restaurant.id },
      select: { id: true },
    });
    if (!table) throw new NotFoundError('Table introuvable.');
    tableId = table.id;
  }

  // Le moyen de paiement doit être activé par ce restaurant, opérationnel sur
  // l'instance et compatible avec le mode de retrait choisi.
  const allowed = availableProvidersFor({
    enabledIds: restaurant.settings?.paymentProviders ?? [],
    currency: restaurant.currency,
    fulfillmentType: input.fulfillmentType,
  });
  if (!allowed.some((provider) => provider.id === input.paymentProvider)) {
    throw new ValidationError("Ce moyen de paiement n'est pas disponible.", {
      paymentProvider: 'Choisissez un autre moyen de paiement.',
    });
  }

  const order = await createOrder({
    restaurantId: restaurant.id,
    items: input.items,
    fulfillmentType: input.fulfillmentType,
    deliveryZoneId: input.deliveryZoneId,
    promoCode: input.promoCode,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    deliveryAddress: input.deliveryAddress,
    deliveryLat: input.deliveryLat,
    deliveryLng: input.deliveryLng,
    instructions: input.instructions,
    paymentProvider: input.paymentProvider,
    tableId,
    ip,
  });

  const payment = await initiatePayment({
    orderId: order.id,
    restaurantId: restaurant.id,
    providerId: input.paymentProvider,
    returnUrl: `${env.appUrl}/r/${restaurant.slug}/commande/${order.id}`,
  });

  // Attendu explicitement : une promesse « fire-and-forget » non suivie par
  // `waitUntil()` peut être coupée en cours de route par un runtime edge
  // (Cloudflare Workers) avant sa fin.
  await trackEvent({
    restaurantId: restaurant.id,
    type: 'ORDER_PLACED',
    metadata: { orderId: order.id, total: order.total },
  });

  return ok(
    {
      order: {
        id: order.id,
        number: order.number,
        total: order.total,
        currency: order.currency,
      },
      payment: {
        status: payment.status,
        reference: payment.payment.reference,
        redirectUrl: payment.redirectUrl ?? null,
        instructions: payment.instructions ?? null,
      },
      confirmationUrl: `/r/${restaurant.slug}/commande/${order.id}`,
    },
    201,
  );
});
