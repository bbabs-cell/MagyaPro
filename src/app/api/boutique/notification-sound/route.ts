import { fail, ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { uploadStoreNotificationSound } from '@/lib/storage';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

/**
 * Son de notification personnalisé, joué à l'arrivée d'un événement
 * (commande, rupture de stock, etc.) — équivalent de
 * `/api/restaurant/notification-sound`.
 */
export const POST = route(async (request) => {
  const context = await requireStore('settings:manage');
  await hit(`boutique-upload:${context.store.id}`, RATE_LIMITS.upload);

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return fail('Requête de téléversement invalide.', 400, 'VALIDATION_ERROR');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ValidationError('Aucun fichier reçu.');
  }

  const stored = await uploadStoreNotificationSound({ file, storeId: context.store.id });

  await prisma.store.update({
    where: { id: context.store.id },
    data: { notificationSoundUrl: stored.url },
  });

  return ok({ url: stored.url }, 201);
});

/** Retire le son personnalisé : la notification revient au bip par défaut. */
export const DELETE = route(async () => {
  const context = await requireStore('settings:manage');

  await prisma.store.update({
    where: { id: context.store.id },
    data: { notificationSoundUrl: null },
  });

  return ok({ removed: true });
});
