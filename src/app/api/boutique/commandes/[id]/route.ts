import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeOrderStatusSchema } from '@/lib/validation';
import { ConflictError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { notifyCustomerOrderEvent } from '@/lib/boutique/order-notifications';
import type { StoreOrder } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

/** Change le statut d'une commande en ligne — jamais depuis un état final (terminée/annulée). */
export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('orders:manage');
  const { id } = await params;

  const order = await findStoreScopedOrThrow<StoreOrder>('storeOrder', context.store.id, id);
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new ConflictError('Cette commande est déjà finalisée.');
  }

  const { status } = parseOrThrow(storeOrderStatusSchema, await readJson(request));

  const updated = await prisma.storeOrder.update({
    where: { id: order.id },
    data: { status },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_ORDER_STATUS_CHANGED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_order',
    targetId: order.id,
    metadata: { from: order.status, to: status },
  });

  // Pas de message pour COMPLETED : le client vient de retirer sa commande
  // en personne, l'avertir n'apporte rien.
  if (status === 'CONFIRMED' || status === 'READY' || status === 'CANCELLED') {
    await notifyCustomerOrderEvent(status, updated, context.store.name);
  }

  return ok({ order: updated });
});
