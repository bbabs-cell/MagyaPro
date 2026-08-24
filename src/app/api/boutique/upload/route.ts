import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { ValidationError } from '@/lib/errors';
import { uploadStoreImage } from '@/lib/storage';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const folderSchema = z.enum(['logos', 'covers']);

/**
 * Téléversement d'image pour une boutique — équivalent de `/api/upload`
 * (Restaurant). Le fichier est rangé sous l'identifiant de la boutique issu
 * du contexte serveur, jamais d'un identifiant envoyé par le client.
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

  const folderResult = folderSchema.safeParse(formData.get('folder'));
  if (!folderResult.success) {
    throw new ValidationError('Destination de téléversement invalide.');
  }

  const stored = await uploadStoreImage({
    file,
    storeId: context.store.id,
    folder: folderResult.data,
  });

  return ok({ url: stored.url, key: stored.key, size: stored.size }, 201);
});
