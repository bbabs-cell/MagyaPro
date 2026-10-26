import { z } from 'zod';

import { fail, ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
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
  // L'adresse du fichier ne change pas d'un envoi à l'autre : le paramètre de
  // version force les navigateurs (et l'optimiseur d'images) à recharger.
  const url = `${stored.url}?v=${Date.now()}`;
  await prisma.template.update({ where: { key: keyResult.data }, data: { previewImageUrl: url } });
  return ok({ url }, 201);
});

/** Retire l'image envoyée : le template revient à sa capture livrée avec le code. */
export const DELETE = route(async (request) => {
  await requireSuperAdmin();

  const keyResult = z
    .string()
    .refine((key) => TEMPLATE_KEYS.has(key))
    .safeParse(new URL(request.url).searchParams.get('templateKey'));
  if (!keyResult.success) {
    throw new ValidationError('Template inconnu.');
  }

  await prisma.template.update({ where: { key: keyResult.data }, data: { previewImageUrl: null } });
  return ok({ url: null });
});
