import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { NotFoundError } from '@/lib/errors';

/** Notifications d'une boutique — commandes, stock, paiements reçus, abonnement. */
export const GET = route(async () => {
  const { store } = await requireStore('store:view');

  const notifications = await prisma.notification.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return ok({ notifications });
});

const markReadSchema = z.object({
  id: z.string().min(1).optional(),
  markAll: z.boolean().default(false),
});

/** Marque une notification (ou toutes) comme lue. */
export const PATCH = route(async (request) => {
  const context = await requireStore('store:view');
  const input = parseOrThrow(markReadSchema, await readJson(request));

  if (input.markAll) {
    await prisma.notification.updateMany({
      where: { storeId: context.store.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ success: true });
  }

  if (!input.id) throw new NotFoundError('Notification introuvable.');

  const notification = await prisma.notification.findFirst({
    where: { id: input.id, storeId: context.store.id },
  });
  if (!notification) throw new NotFoundError('Notification introuvable.');

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  return ok({ success: true });
});
