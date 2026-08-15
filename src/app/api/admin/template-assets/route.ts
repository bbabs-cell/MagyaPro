import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ValidationError } from '@/lib/errors';
import { uploadTemplatePreview } from '@/lib/storage';
import { TEMPLATES } from '@/lib/templates/registry';

const TEMPLATE_KEYS = new Set(TEMPLATES.map((template) => template.key));

/** Vignette d'aperçu d'un template — asset de plateforme, pas d'un tenant. */
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

  const keyResult = z.string().refine((key) => TEMPLATE_KEYS.has(key)).safeParse(
    formData.get('templateKey'),
  );
  if (!keyResult.success) {
    throw new ValidationError('Template inconnu.');
  }

  const stored = await uploadTemplatePreview({ file, templateKey: keyResult.data });
  return ok({ url: stored.url }, 201);
});
