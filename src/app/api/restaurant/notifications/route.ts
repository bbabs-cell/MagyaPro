import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { NotFoundError } from '@/lib/errors';

/**
 * Notifications d'un restaurant — équivalent de `/api/boutique/notifications`.
 * Le modèle `Notification` était déjà alimenté côté Restaurant (réservations,
 * preuves de paiement, abonnement) mais rien ne l'exposait encore : seules
 * les commandes avaient leur propre circuit dédié (`/api/alertes`).
 */
export const GET = route(async () => {
  const { restaurant } = await requireTenant('restaurant:view');

  const [notifications, settings] = await Promise.all([
    prisma.notification.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
      select: { notificationSoundUrl: true },
    }),
  ]);

  return ok({ notifications, notificationSoundUrl: settings?.notificationSoundUrl ?? null });
});

const markReadSchema = z.object({
  id: z.string().min(1).optional(),
  markAll: z.boolean().default(false),
});

/** Marque une notification (ou toutes) comme lue. */
export const PATCH = route(async (request) => {
  const context = await requireTenant('restaurant:view');
  const input = parseOrThrow(markReadSchema, await readJson(request));

  if (input.markAll) {
    await prisma.notification.updateMany({
      where: { restaurantId: context.restaurant.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ success: true });
  }

  if (!input.id) throw new NotFoundError('Notification introuvable.');

  const notification = await prisma.notification.findFirst({
    where: { id: input.id, restaurantId: context.restaurant.id },
  });
  if (!notification) throw new NotFoundError('Notification introuvable.');

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  return ok({ success: true });
});
