import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeTaxSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/** Réglages avancés d'une boutique — pour l'instant, uniquement la TVA appliquée en caisse. */
export const PATCH = route(async (request) => {
  const context = await requireStore('settings:manage');
  const input = parseOrThrow(storeTaxSchema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: { taxEnabled: input.taxEnabled, taxRate: input.taxRate },
    select: { id: true, taxEnabled: true, taxRate: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    metadata: { taxEnabled: input.taxEnabled, taxRate: input.taxRate },
  });

  return ok({ store });
});
