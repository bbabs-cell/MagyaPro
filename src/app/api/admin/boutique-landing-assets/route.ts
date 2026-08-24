import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ValidationError } from '@/lib/errors';
import { uploadBoutiqueLandingAsset } from '@/lib/storage';

const kindSchema = z.enum(['logo', 'cover']);

/** Logo/couverture de la page d'accueil de MagyaPro Boutique — asset plateforme. */
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

  const parsedKind = kindSchema.safeParse(formData.get('kind'));
  if (!parsedKind.success) {
    throw new ValidationError('Type d\'image invalide.');
  }

  const stored = await uploadBoutiqueLandingAsset({ file, kind: parsedKind.data });
  return ok({ url: stored.url }, 201);
});
