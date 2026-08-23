import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

/** Révoque une clé d'API — jamais supprimée, pour garder trace de son usage passé. */
export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('api:manage');
  const { id } = await params;

  const key = await prisma.storeApiKey.findFirst({ where: { id, storeId: context.store.id } });
  if (!key) throw new NotFoundError("Clé d'API introuvable.");

  await prisma.storeApiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_API_KEY_REVOKED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_api_key',
    targetId: key.id,
    metadata: { name: key.name },
  });

  return ok({ success: true });
});
