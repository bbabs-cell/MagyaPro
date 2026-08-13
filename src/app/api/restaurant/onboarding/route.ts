import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { ValidationError } from '@/lib/errors';

const schema = z.object({
  /** Étape atteinte, sauvegardée à chaque avancée. */
  step: z.number().int().min(0).max(10),
  complete: z.boolean().default(false),
});

/**
 * Progression de l'onboarding.
 *
 * L'étape courante est persistée à chaque passage : un restaurateur qui ferme
 * son navigateur au milieu du parcours le reprend exactement là où il en
 * était, avec les données déjà saisies — celles-ci ayant été enregistrées par
 * les routes métier au fur et à mesure.
 */
export const PATCH = route(async (request) => {
  const context = await requireTenant('restaurant:update');
  const input = parseOrThrow(schema, await readJson(request));

  if (input.complete) {
    // Terminer l'onboarding suppose un menu minimal : sans plat, le site
    // publié serait vide et le restaurateur croirait avoir fini.
    const productCount = await prisma.product.count({
      where: { restaurantId: context.restaurant.id },
    });
    if (productCount === 0) {
      throw new ValidationError(
        'Ajoutez au moins un plat avant de terminer la configuration.',
      );
    }
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: context.restaurant.id },
    data: {
      onboardingStep: input.step,
      onboardingCompletedAt: input.complete
        ? (context.restaurant.onboardingCompletedAt ?? new Date())
        : undefined,
    },
    select: { onboardingStep: true, onboardingCompletedAt: true },
  });

  return ok({ restaurant });
});
