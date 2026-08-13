import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { restaurantAppearanceSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { currentClientIp } from '@/lib/auth/session';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { PREMIUM_TEMPLATE_KEYS } from '@/lib/templates/registry';

export const PATCH = route(async (request) => {
  const context = await requireTenant('restaurant:update');
  const input = parseOrThrow(restaurantAppearanceSchema, await readJson(request));

  // Le template doit exister et être actif : accepter une clé arbitraire
  // laisserait un restaurant avec un site qui ne sait pas se rendre.
  const template = await prisma.template.findUnique({
    where: { key: input.templateKey },
  });
  if (!template || !template.isActive) {
    throw new ValidationError("Le template choisi n'est pas disponible.", {
      templateKey: 'Choisissez un template disponible.',
    });
  }

  if (PREMIUM_TEMPLATE_KEYS.has(input.templateKey)) {
    const entitlements = await getEntitlements(context.restaurant.id);
    if (!hasFeature(entitlements, FEATURES.PREMIUM_TEMPLATES)) {
      throw new ValidationError(
        `Le template « ${template.name} » est réservé aux plans incluant les templates premium.`,
        { templateKey: 'Template non inclus dans votre plan.' },
      );
    }
  }

  // Changer de template ne touche à aucune donnée métier : seules les colonnes
  // de présentation sont écrites ici.
  const restaurant = await prisma.restaurant.update({
    where: { id: context.restaurant.id },
    data: {
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      fontFamily: input.fontFamily,
      templateKey: input.templateKey,
      logoUrl: input.logoUrl ?? null,
      coverUrl: input.coverUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.RESTAURANT_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: restaurant.id,
    targetType: 'restaurant',
    targetId: restaurant.id,
    ip: await currentClientIp(),
    metadata: { section: 'apparence', templateKey: input.templateKey },
  });

  return ok({ restaurant });
});
