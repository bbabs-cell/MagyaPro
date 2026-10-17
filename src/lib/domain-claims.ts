import { prisma } from '@/lib/db';
import { ConflictError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { domainVerificationToken } from '@/lib/domains';

/**
 * Revendication d'un domaine personnalisé par un restaurant.
 *
 * `hostname` est unique sur la plateforme, mais seul un domaine **vérifié**
 * appartient à son restaurant. Une revendication en attente ne prouve rien :
 * la laisser bloquer l'adresse permettait d'empêcher son vrai propriétaire
 * de l'ajouter. Elle est donc reprise par le restaurant qui la demande — ce
 * qui ne coûte rien au vrai propriétaire, puisque la valeur TXT attendue est
 * dérivée du couple restaurant/domaine (`domainVerificationToken`) : il
 * l'ajoute de nouveau, retrouve la même valeur, et son enregistrement DNS le
 * vérifie aussitôt.
 */
export async function claimCustomDomain(params: {
  restaurantId: string;
  hostname: string;
  actor: { id: string; email: string };
}) {
  const { restaurantId, hostname, actor } = params;
  const taken = await prisma.domain.findUnique({
    where: { hostname },
    select: { id: true, restaurantId: true, status: true, type: true },
  });
  if (taken?.restaurantId === restaurantId) {
    throw new ConflictError('Ce domaine est déjà enregistré sur votre restaurant.');
  }
  if (taken && (taken.status === 'VERIFIED' || taken.type !== 'CUSTOM')) {
    throw new ConflictError(
      "Ce domaine est déjà relié à un autre restaurant. S'il vous appartient, écrivez-nous : nous vérifierons avec vous.",
    );
  }

  const data = {
    restaurantId,
    hostname,
    type: 'CUSTOM' as const,
    status: 'PENDING' as const,
    verificationToken: domainVerificationToken(restaurantId, hostname),
    verifiedAt: null,
    lastCheckedAt: null,
    isPrimary: false,
  };

  // Reprise conditionnelle : si l'autre restaurant vient de vérifier le
  // domaine entre la lecture et l'écriture, rien n'est modifié.
  const domain = taken
    ? await prisma.$transaction(async (tx) => {
        const { count } = await tx.domain.updateMany({
          where: { id: taken.id, status: { not: 'VERIFIED' } },
          data,
        });
        if (count === 0) throw new ConflictError('Ce domaine vient d’être vérifié par un autre restaurant.');
        return tx.domain.findUniqueOrThrow({ where: { id: taken.id } });
      })
    : await prisma.domain.create({ data });

  if (taken) {
    // Trace côté restaurant qui perd la revendication : elle n'était pas
    // vérifiée, mais il doit pouvoir comprendre où son domaine est passé.
    await recordAudit({
      action: AUDIT_ACTIONS.DOMAIN_REMOVED,
      actorUserId: actor.id,
      actorEmail: actor.email,
      restaurantId: taken.restaurantId,
      targetType: 'domain',
      targetId: taken.id,
      metadata: { hostname, reason: 'claimed_by_other_restaurant' },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.DOMAIN_ADDED,
    actorUserId: actor.id,
    actorEmail: actor.email,
    restaurantId,
    targetType: 'domain',
    targetId: domain.id,
    metadata: { hostname },
  });

  return domain;
}
