import { fail, ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ValidationError } from '@/lib/errors';
import { updatePlatformSettings } from '@/lib/platform-settings';
import { uploadPlatformNotificationSound } from '@/lib/storage';

/**
 * Son joué dans l'espace Super Admin à l'arrivée d'une notification —
 * équivalent de `/api/boutique/notification-sound`, à l'échelle de la
 * plateforme plutôt que d'un tenant.
 */
export const POST = route(async (request) => {
  await requireSuperAdmin();

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return fail('Requête de téléversement invalide.', 400, 'VALIDATION_ERROR');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ValidationError('Aucun fichier reçu.');
  }

  const stored = await uploadPlatformNotificationSound({ file });
  await updatePlatformSettings({ notificationSoundUrl: stored.url });

  return ok({ url: stored.url }, 201);
});

/** Retire le son personnalisé : la notification revient au bip par défaut. */
export const DELETE = route(async () => {
  await requireSuperAdmin();
  await updatePlatformSettings({ notificationSoundUrl: null });
  return ok({ removed: true });
});
