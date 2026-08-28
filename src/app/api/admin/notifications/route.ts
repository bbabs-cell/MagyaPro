import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { getPlatformSettings } from '@/lib/platform-settings';
import { listPlatformNotifications } from '@/lib/platform-notifications';

/**
 * Notifications de l'espace Super Admin, avec le son à jouer à l'arrivée
 * d'une nouvelle — même contrat que `/api/restaurant/notifications` et
 * `/api/boutique/notifications`, pour que le même composant de surveillance
 * serve les trois espaces.
 */
export const GET = route(async () => {
  await requireSuperAdmin();

  const [notifications, settings] = await Promise.all([
    listPlatformNotifications(),
    getPlatformSettings(),
  ]);

  return ok({
    notifications,
    notificationSoundUrl: settings?.notificationSoundUrl ?? null,
  });
});

const markReadSchema = z.object({
  id: z.string().min(1).optional(),
  markAll: z.boolean().default(false),
});

/** Marque une notification (ou toutes) comme lue. Boîte commune : lue par un Super Admin, lue pour tous. */
export const PATCH = route(async (request) => {
  await requireSuperAdmin();
  const input = parseOrThrow(markReadSchema, await readJson(request));

  if (input.markAll) {
    await prisma.platformNotification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ success: true });
  }

  if (!input.id) throw new NotFoundError('Notification introuvable.');

  const notification = await prisma.platformNotification.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!notification) throw new NotFoundError('Notification introuvable.');

  await prisma.platformNotification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  return ok({ success: true });
});
