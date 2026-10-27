import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { staffOrderSchema } from '@/lib/validation';
import { createStaffOrder } from '@/lib/orders/staff-order';
import { currentClientIp } from '@/lib/auth/session';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

/**
 * Commande prise par le restaurant : au comptoir, ou au téléphone — y compris
 * celles saisies pendant une coupure et envoyées au retour du réseau. Toute la
 * logique est dans `createStaffOrder` (`lib/orders/staff-order.ts`).
 */
export const POST = route(async (request) => {
  const context = await requireTenant('orders:create');

  // Deux garde-fous indépendants, comme pour le service à table : la
  // permission dit qui, dans l'équipe, a le droit de saisir une commande ; le
  // plan dit si le restaurant a souscrit cette fonctionnalité. L'un ne
  // remplace pas l'autre, et c'est ici que la vérification compte — masquer le
  // bouton ne protège rien.
  requireFeature(await getEntitlements(context.restaurant.id), FEATURES.COUNTER_ORDERS);

  const input = parseOrThrow(staffOrderSchema, await readJson(request));

  const order = await createStaffOrder({
    restaurantId: context.restaurant.id,
    userId: context.user.id,
    userEmail: context.user.email,
    input,
    ip: await currentClientIp(),
  });

  return ok({ order }, 201);
});
