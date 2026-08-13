import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { currentClientIp } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/entitlements';

const schema = z.object({ published: z.boolean() });

/**
 * Publication du site public.
 *
 * La publication bascule le restaurant de DRAFT à ACTIVE. Un restaurant
 * suspendu par l'administration ne peut pas se republier lui-même : seul le
 * Super Admin lève une suspension.
 */
export const POST = route(async (request) => {
  const context = await requireTenant('restaurant:publish');
  const { published } = parseOrThrow(schema, await readJson(request));

  if (context.restaurant.status === 'SUSPENDED') {
    throw new ValidationError(
      'Ce restaurant est suspendu. Contactez le support Magya pour le réactiver.',
    );
  }

  if (published) {
    const entitlements = await getEntitlements(context.restaurant.id);
    if (!entitlements.isActive) {
      throw new ValidationError(
        "Votre abonnement n'est pas actif. Régularisez-le pour publier votre site.",
      );
    }

    // Un site sans plat disponible afficherait une carte vide aux clients :
    // mieux vaut refuser la publication en l'expliquant.
    const availableProducts = await prisma.product.count({
      where: { restaurantId: context.restaurant.id, isAvailable: true },
    });
    if (availableProducts === 0) {
      throw new ValidationError(
        'Ajoutez au moins un plat disponible avant de publier votre site.',
      );
    }
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: context.restaurant.id },
    data: {
      status: published ? 'ACTIVE' : 'DRAFT',
      publishedAt: published ? new Date() : null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.RESTAURANT_PUBLISHED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: restaurant.id,
    targetType: 'restaurant',
    targetId: restaurant.id,
    ip: await currentClientIp(),
    metadata: { published },
  });

  return ok({ status: restaurant.status, publishedAt: restaurant.publishedAt });
});
