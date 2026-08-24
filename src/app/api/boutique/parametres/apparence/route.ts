import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeAppearanceSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { currentClientIp } from '@/lib/auth/session';

/**
 * Identité visuelle du site public de la boutique — template, couleurs,
 * typographie, images. Équivalent de `/api/restaurant/apparence`.
 */
export const PATCH = route(async (request) => {
  const context = await requireStore('settings:manage');
  const input = parseOrThrow(storeAppearanceSchema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: {
      templateKey: input.templateKey,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      fontFamily: input.fontFamily,
      logoUrl: input.logoUrl ?? null,
      coverUrl: input.coverUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    ip: await currentClientIp(),
    metadata: { section: 'apparence', templateKey: input.templateKey },
  });

  return ok({ store });
});
