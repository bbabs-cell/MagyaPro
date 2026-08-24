import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeTemplateSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/** Mise en page du site public de la boutique — voir `src/components/site-store/templates`. */
export const PATCH = route(async (request) => {
  const context = await requireStore('settings:manage');
  const { templateKey } = parseOrThrow(storeTemplateSchema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: { templateKey },
    select: { id: true, templateKey: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    metadata: { templateKey },
  });

  return ok({ store });
});
