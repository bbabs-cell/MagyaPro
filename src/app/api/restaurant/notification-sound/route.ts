import { fail, ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { uploadNotificationSound } from '@/lib/storage';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

/**
 * Son de notification personnalisé, joué à l'arrivée d'une commande.
 *
 * Distinct de `/api/upload` (images) : le format accepté, la taille limite et
 * le dossier de rangement diffèrent.
 */
export const POST = route(async (request) => {
  const context = await requireTenant('settings:manage');
  await hit(`upload:${context.restaurant.id}`, RATE_LIMITS.upload);

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return fail('Requête de téléversement invalide.', 400, 'VALIDATION_ERROR');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ValidationError('Aucun fichier reçu.');
  }

  const stored = await uploadNotificationSound({ file, restaurantId: context.restaurant.id });

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: context.restaurant.id },
    create: { restaurantId: context.restaurant.id, notificationSoundUrl: stored.url },
    update: { notificationSoundUrl: stored.url },
  });

  return ok({ url: stored.url }, 201);
});

/** Retire le son personnalisé : la notification revient au bip par défaut. */
export const DELETE = route(async () => {
  const context = await requireTenant('settings:manage');

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: context.restaurant.id },
    create: { restaurantId: context.restaurant.id, notificationSoundUrl: null },
    update: { notificationSoundUrl: null },
  });

  return ok({ removed: true });
});
