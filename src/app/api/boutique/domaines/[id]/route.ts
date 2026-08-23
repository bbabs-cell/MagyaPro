import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { ConflictError } from '@/lib/errors';
import { verifyDomain } from '@/lib/domains';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import type { StoreDomain } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

/** Déclenche la vérification DNS du domaine — miroir de `/api/domaines/[id]`. */
export const POST = route(async (_request, { params }: Params) => {
  const context = await requireStore('settings:manage');
  const { id } = await params;

  const domain = await findStoreScopedOrThrow<StoreDomain>('storeDomain', context.store.id, id);

  const result = await verifyDomain(domain.hostname, domain.verificationToken);

  const updated = await prisma.storeDomain.update({
    where: { id: domain.id },
    data: {
      status: result.verified ? 'VERIFIED' : 'FAILED',
      verifiedAt: result.verified ? new Date() : null,
      lastCheckedAt: new Date(),
    },
  });

  if (result.verified) {
    await recordAudit({
      action: AUDIT_ACTIONS.STORE_DOMAIN_VERIFIED,
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      storeId: context.store.id,
      targetType: 'store_domain',
      targetId: domain.id,
      metadata: { hostname: domain.hostname },
    });
  }

  return ok({ domain: updated, verified: result.verified, detail: result.detail });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('settings:manage');
  const { id } = await params;

  const domain = await findStoreScopedOrThrow<StoreDomain>('storeDomain', context.store.id, id);

  // Le sous-domaine de la plateforme est l'adresse de repli de la boutique :
  // le supprimer rendrait le site inaccessible.
  if (domain.type === 'SUBDOMAIN') {
    throw new ConflictError("L'adresse Magyapro de la boutique ne peut pas être supprimée.");
  }

  await prisma.storeDomain.delete({ where: { id: domain.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_DOMAIN_REMOVED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_domain',
    targetId: domain.id,
    metadata: { hostname: domain.hostname },
  });

  return ok({ deleted: true });
});
