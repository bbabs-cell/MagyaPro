import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { ConflictError } from '@/lib/errors';
import { verifyDomain } from '@/lib/domains';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

/** Déclenche la vérification DNS du domaine. */
export const POST = route(async (_request, { params }: Params) => {
  const context = await requireTenant('domains:manage');
  const { id } = await params;

  const domain = await findScopedOrThrow<{
    id: string;
    hostname: string;
    verificationToken: string;
    type: string;
  }>('domain', context.restaurant.id, id);

  const result = await verifyDomain(domain.hostname, domain.verificationToken);

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      status: result.verified ? 'VERIFIED' : 'FAILED',
      verifiedAt: result.verified ? new Date() : null,
      lastCheckedAt: new Date(),
    },
  });

  if (result.verified) {
    await recordAudit({
      action: AUDIT_ACTIONS.DOMAIN_VERIFIED,
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      restaurantId: context.restaurant.id,
      targetType: 'domain',
      targetId: domain.id,
      metadata: { hostname: domain.hostname },
    });
  }

  return ok({ domain: updated, verified: result.verified, detail: result.detail });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('domains:manage');
  const { id } = await params;

  const domain = await findScopedOrThrow<{ id: string; hostname: string; type: string }>(
    'domain',
    context.restaurant.id,
    id,
  );

  // Le sous-domaine de la plateforme est l'adresse de repli du restaurant :
  // le supprimer rendrait le site inaccessible.
  if (domain.type === 'SUBDOMAIN') {
    throw new ConflictError(
      "L'adresse Magyapro du restaurant ne peut pas être supprimée.",
    );
  }

  await prisma.domain.delete({ where: { id: domain.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.DOMAIN_REMOVED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'domain',
    targetId: domain.id,
    metadata: { hostname: domain.hostname },
  });

  return ok({ deleted: true });
});
