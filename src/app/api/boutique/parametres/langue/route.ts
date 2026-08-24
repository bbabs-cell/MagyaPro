import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeLanguageSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/** Langue du site public de la boutique — voir `src/lib/i18n/boutique-site.ts`. */
export const PATCH = route(async (request) => {
  const context = await requireStore('settings:manage');
  const { language } = parseOrThrow(storeLanguageSchema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: { language },
    select: { id: true, language: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    metadata: { language },
  });

  return ok({ store });
});
