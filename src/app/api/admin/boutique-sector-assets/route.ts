import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ValidationError } from '@/lib/errors';
import { BOUTIQUE_SECTORS, uploadBoutiqueSectorImage } from '@/lib/storage';

const sectorSchema = z.enum(BOUTIQUE_SECTORS);

/** Image d'un secteur d'activité sur la page d'accueil MagyaPro Boutique — asset de plateforme. */
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

  const sectorResult = sectorSchema.safeParse(formData.get('sector'));
  if (!sectorResult.success) {
    throw new ValidationError('Secteur invalide.');
  }

  const stored = await uploadBoutiqueSectorImage({ file, sector: sectorResult.data });
  return ok({ url: stored.url }, 201);
});
