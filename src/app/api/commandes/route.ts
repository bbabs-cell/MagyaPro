import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { staffOrderSchema } from '@/lib/validation';
import { createOrder, markOrderPaid, updateOrderStatus } from '@/lib/orders/service';
import { currentClientIp } from '@/lib/auth/session';
import { requireTenant } from '@/lib/tenant';
import { trackEvent } from '@/lib/analytics';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';

/**
 * Commande prise par le restaurant : au comptoir, ou au téléphone.
 *
 * Jusqu'ici une commande ne pouvait naître que du site public. Un client qui
 * appelait, ou qui se présentait au comptoir, n'existait nulle part dans le
 * produit : sa commande se notait sur un carnet, ne passait pas en cuisine, ne
 * comptait pas dans le chiffre d'affaires, et n'apparaissait sur aucun écran.
 *
 * Toute la logique est celle de `createOrder`, déjà utilisée par le site :
 * même tarification relue en base, même numérotation atomique, même fiche
 * client, même consommation de code promo. Rien n'est réécrit ici — une
 * seconde façon de créer une commande finirait par diverger de la première,
 * et c'est sur les montants que cela se verrait.
 *
 * Trois différences, et elles tiennent toutes à qui saisit :
 *
 * 1. **Aucun montant, ici non plus.** Le corps ne porte que des identifiants
 *    de produits et des quantités. Un employé ne doit pas pouvoir fixer un
 *    prix depuis le navigateur, pas plus qu'un client.
 *
 * 2. **Le règlement est physique**, déduit du mode de retrait. Le client n'est
 *    pas devant un écran : il n'y a ni redirection, ni paiement en ligne à
 *    initier. Les modes hors ligne ne dépendent donc pas des réglages publics
 *    du restaurant — ces réglages gouvernent ce qui est proposé au client sur
 *    le site, pas ce que le restaurateur encaisse à sa caisse.
 *
 * 3. **La commande naît confirmée.** Le restaurateur vient de la saisir ; lui
 *    demander de la confirmer ensuite serait un geste vide, et la commande
 *    attendrait en cuisine pendant ce temps.
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

  // Une commande « sur place » occupe une table : elle doit donc désigner une
  // table réelle de ce restaurant, et pas un identifiant venu d'ailleurs.
  let tableId: string | null = null;
  if (input.fulfillmentType === 'DINE_IN' && input.tableId) {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: input.tableId, restaurantId: context.restaurant.id },
      select: { id: true },
    });
    if (!table) throw new NotFoundError('Table introuvable.');
    tableId = table.id;
  }

  if (input.fulfillmentType === 'DELIVERY' && !input.deliveryZoneId) {
    throw new ValidationError('Choisissez une zone de livraison.', {
      deliveryZoneId: 'La zone détermine les frais de livraison.',
    });
  }

  const order = await createOrder({
    restaurantId: context.restaurant.id,
    items: input.items,
    fulfillmentType: input.fulfillmentType,
    deliveryZoneId: input.deliveryZoneId,
    promoCode: input.promoCode,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    instructions: input.instructions,
    // Le mode de règlement suit le mode de retrait : on encaisse à la remise
    // pour une livraison, au comptoir sinon.
    paymentProvider:
      input.fulfillmentType === 'DELIVERY' ? 'cash_on_delivery' : 'pay_at_store',
    tableId,
    ip: await currentClientIp(),
  });

  await updateOrderStatus({
    restaurantId: context.restaurant.id,
    orderId: order.id,
    status: 'CONFIRMED',
    userId: context.user.id,
    actorEmail: context.user.email,
  });

  // Encaissement immédiat, fréquent au comptoir. Séparé de la confirmation :
  // une commande téléphonée réglée à la livraison ne doit pas apparaître payée
  // avant que l'argent n'arrive.
  if (input.alreadyPaid) {
    await markOrderPaid({
      restaurantId: context.restaurant.id,
      orderId: order.id,
      actorUserId: context.user.id,
      actorEmail: context.user.email,
    });
  }

  await trackEvent({
    restaurantId: context.restaurant.id,
    type: 'ORDER_PLACED',
    metadata: { orderId: order.id, total: order.total, source: 'staff' },
  });

  return ok({ order: { id: order.id, number: order.number, total: order.total } }, 201);
});
