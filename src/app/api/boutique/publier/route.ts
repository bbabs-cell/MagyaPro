import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { currentClientIp } from '@/lib/auth/session';

const schema = z.object({ published: z.boolean() });

/**
 * Publication du site public d'une boutique — miroir de
 * `/api/restaurant/publier` : bascule `status` entre DRAFT et ACTIVE, jamais
 * automatique. Sans cette action explicite, une boutique reste en brouillon
 * indéfiniment (`Store.status` vaut `DRAFT` à la création, voir
 * `src/lib/boutique/auth.ts`) — c'est le comportement voulu : le
 * commerçant choisit quand son catalogue devient visible.
 */
export const POST = route(async (request) => {
  const context = await requireStore('store:publish');
  const { published } = parseOrThrow(schema, await readJson(request));

  if (context.store.status === 'SUSPENDED') {
    throw new ValidationError(
      'Cette boutique est suspendue. Contactez le support Magyapro pour la réactiver.',
    );
  }

  if (published) {
    // Un catalogue sans produit disponible afficherait une vitrine vide aux
    // clients : mieux vaut refuser la publication en l'expliquant.
    const availableProducts = await prisma.storeProduct.count({
      where: { storeId: context.store.id, status: 'ACTIVE' },
    });
    if (availableProducts === 0) {
      throw new ValidationError(
        'Ajoutez au moins un produit actif avant de publier votre boutique.',
      );
    }
  }

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: {
      status: published ? 'ACTIVE' : 'DRAFT',
      publishedAt: published ? new Date() : null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_PUBLISHED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: store.id,
    targetType: 'store',
    targetId: store.id,
    ip: await currentClientIp(),
    metadata: { published },
  });

  return ok({ status: store.status, publishedAt: store.publishedAt });
});
