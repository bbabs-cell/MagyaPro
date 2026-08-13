import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { ValidationError } from '@/lib/errors';
import { uploadImage } from '@/lib/storage';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const folderSchema = z.enum(['logos', 'covers', 'products', 'categories', 'seo']);

/**
 * Téléversement d'image.
 *
 * Le fichier est validé (taille, signature binaire) puis rangé sous
 * l'identifiant du restaurant issu de la session — un utilisateur ne peut donc
 * pas écrire dans l'espace d'un autre tenant.
 */
export const POST = route(async (request) => {
  const context = await requireTenant('restaurant:update');
  hit(`upload:${context.restaurant.id}`, RATE_LIMITS.upload);

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

  const stored = await uploadImage({
    file,
    restaurantId: context.restaurant.id,
    folder: folderResult.data,
  });

  return ok({ url: stored.url, key: stored.key, size: stored.size }, 201);
});
