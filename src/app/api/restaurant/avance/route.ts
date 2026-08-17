import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { restaurantAdvancedSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';

/**
 * Réglages avancés : TVA (affichage seulement — les prix restent TTC) et
 * identifiants de suivi propres au restaurant (Google Analytics, Meta
 * Pixel).
 */
export const PATCH = route(async (request) => {
  const context = await requireTenant('settings:manage');
  const input = parseOrThrow(restaurantAdvancedSchema, await readJson(request));

  if (input.taxEnabled && input.taxRate === null) {
    throw new ValidationError('Indiquez un taux pour activer la TVA.', {
      taxRate: 'Taux requis.',
    });
  }

  const settings = await prisma.restaurantSettings.upsert({
    where: { restaurantId: context.restaurant.id },
    create: {
      restaurantId: context.restaurant.id,
      taxEnabled: input.taxEnabled,
      taxRate: input.taxRate,
      taxLabel: input.taxLabel || 'TVA',
      googleAnalyticsId: input.googleAnalyticsId ?? null,
      metaPixelId: input.metaPixelId ?? null,
    },
    update: {
      taxEnabled: input.taxEnabled,
      taxRate: input.taxRate,
      taxLabel: input.taxLabel || 'TVA',
      googleAnalyticsId: input.googleAnalyticsId ?? null,
      metaPixelId: input.metaPixelId ?? null,
    },
  });

  return ok({ settings });
});
