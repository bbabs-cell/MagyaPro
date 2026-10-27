import type { z } from 'zod';

import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { createOrder, markOrderPaid, updateOrderStatus } from '@/lib/orders/service';
import { trackEvent } from '@/lib/analytics';
import { isUniqueConflictOn } from '@/lib/unique-conflict';
import type { staffOrderSchema } from '@/lib/validation';

/**
 * Commande prise par le restaurant : au comptoir, ou au téléphone.
 *
 * Toute la logique de création est celle de `createOrder`, déjà utilisée par
 * le site : même tarification relue en base, même numérotation atomique, même
 * fiche client, même consommation de code promo. Rien n'est réécrit ici — une
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
 *    initier.
 *
 * 3. **La commande naît confirmée.** Le restaurateur vient de la saisir ; lui
 *    demander de la confirmer ensuite serait un geste vide, et la commande
 *    attendrait en cuisine pendant ce temps.
 *
 * ## Hors connexion
 *
 * Une commande saisie pendant une coupure attend sur l'appareil et part au
 * retour du réseau, avec l'identifiant tiré par l'écran avant le premier
 * envoi (`clientRequestId`). Une commande déjà reçue est rendue telle quelle,
 * **avant** toute validation : entre la saisie et l'envoi, un plat a pu être
 * marqué épuisé ou un code promo expirer — revalider une commande déjà
 * enregistrée pourrait la refuser, et l'écran la croirait perdue.
 */
export async function createStaffOrder(params: {
  restaurantId: string;
  userId: string;
  userEmail: string;
  input: z.infer<typeof staffOrderSchema>;
  ip?: string | null;
}) {
  const { restaurantId, userId, userEmail, input } = params;

  if (input.clientRequestId) {
    const existing = await findByClientRequest(restaurantId, input.clientRequestId);
    if (existing) return existing;
  }

  // Une commande « sur place » occupe une table : elle doit donc désigner une
  // table réelle de ce restaurant, et pas un identifiant venu d'ailleurs.
  let tableId: string | null = null;
  if (input.fulfillmentType === 'DINE_IN' && input.tableId) {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: input.tableId, restaurantId },
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

  let order;
  try {
    order = await createOrder({
      restaurantId,
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
      paymentProvider: input.fulfillmentType === 'DELIVERY' ? 'cash_on_delivery' : 'pay_at_store',
      tableId,
      ip: params.ip,
      clientRequestId: input.clientRequestId,
    });
  } catch (error) {
    // Deux envois simultanés de la même commande (le réseau revient pendant
    // un envoi manuel) : le second bute sur la contrainte d'unicité, et rend
    // la commande créée par le premier.
    if (input.clientRequestId && isUniqueConflictOn(error, 'clientRequestId')) {
      const existing = await findByClientRequest(restaurantId, input.clientRequestId);
      if (existing) return existing;
    }
    throw error;
  }

  await updateOrderStatus({
    restaurantId,
    orderId: order.id,
    status: 'CONFIRMED',
    userId,
    actorEmail: userEmail,
  });

  // Encaissement immédiat, fréquent au comptoir. Séparé de la confirmation :
  // une commande téléphonée réglée à la livraison ne doit pas apparaître payée
  // avant que l'argent n'arrive.
  if (input.alreadyPaid) {
    await markOrderPaid({ restaurantId, orderId: order.id, actorUserId: userId, actorEmail: userEmail });
  }

  await trackEvent({
    restaurantId,
    type: 'ORDER_PLACED',
    metadata: { orderId: order.id, total: order.total, source: 'staff' },
  });

  return { id: order.id, number: order.number, total: order.total };
}

function findByClientRequest(restaurantId: string, clientRequestId: string) {
  return prisma.order.findUnique({
    where: { restaurantId_clientRequestId: { restaurantId, clientRequestId } },
    select: { id: true, number: true, total: true },
  });
}
