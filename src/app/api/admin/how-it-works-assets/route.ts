import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ValidationError } from '@/lib/errors';
import { uploadHowItWorksImage } from '@/lib/storage';

const stepSchema = z.coerce.number().int().min(1).max(4);

/** Illustrations de la section « Comment ça fonctionne » — asset de plateforme, pas d'un tenant. */
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

  const stepResult = stepSchema.safeParse(formData.get('step'));
  if (!stepResult.success) {
    throw new ValidationError('Étape invalide.');
  }

  const stored = await uploadHowItWorksImage({
    file,
    step: stepResult.data as 1 | 2 | 3 | 4,
  });
  return ok({ url: stored.url }, 201);
});
