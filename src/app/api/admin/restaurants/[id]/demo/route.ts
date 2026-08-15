import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { hexColorSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable(),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  templateKey: z.string().trim().min(1).max(50),
});

/**
 * Édition directe des restaurants de démonstration par le Super Admin.
 *
 * Ce ne sont pas des comptes clients : personne d'autre n'y a accès, donc pas
 * besoin de passer par l'accès support (journalisé, avec motif) pour ajuster
 * une vitrine. Réservé aux restaurants marqués `isDemo` — pour un vrai
 * restaurant, l'accès support reste le seul chemin, par respect pour ses
 * données.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, isDemo: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');
  if (!restaurant.isDemo) {
    throw new ForbiddenError(
      "Seuls les restaurants de démonstration sont modifiables directement — utilisez l'accès support pour un restaurant réel.",
    );
  }

  const input = parseOrThrow(schema, await readJson(request));

  const template = await prisma.template.findUnique({ where: { key: input.templateKey } });
  if (!template) {
    throw new ValidationError('Template inconnu.', { templateKey: 'Choisissez un template disponible.' });
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: input.name,
      description: input.description,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      templateKey: input.templateKey,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.RESTAURANT_UPDATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    restaurantId: restaurant.id,
    targetType: 'restaurant',
    targetId: restaurant.id,
    metadata: { section: 'demo-direct-edit' },
  });

  return ok({ restaurant: updated });
});
