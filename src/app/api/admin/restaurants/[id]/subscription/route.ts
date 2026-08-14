import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp } from '@/lib/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, diffFields, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const subscriptionSchema = z.object({
  planId: z.string().min(1).optional(),
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
  /// Nouvelle date de fin de période, au format ISO.
  currentPeriodEnd: z.string().datetime().optional(),
  /// Nouvelle date de fin d'essai. `null` retire l'essai en cours.
  trialEndsAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Gestion fine d'un abonnement, depuis l'administration.
 *
 * Trois leviers indépendants — changer de plan, prolonger une période
 * (essai ou facturation), forcer un statut — combinables en un seul appel.
 * Chaque changement est journalisé avec l'état avant/après, car il affecte
 * directement ce à quoi le restaurant a droit.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId: id },
    include: { plan: { select: { id: true, name: true } } },
  });
  if (!subscription) throw new NotFoundError('Aucun abonnement rattaché à ce restaurant.');

  const input = parseOrThrow(subscriptionSchema, await readJson(request));

  if (
    input.planId === undefined &&
    input.status === undefined &&
    input.currentPeriodEnd === undefined &&
    input.trialEndsAt === undefined
  ) {
    throw new ValidationError('Aucune modification à appliquer.', {});
  }

  if (input.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true } });
    if (!plan) {
      throw new ValidationError('Plan introuvable.', { planId: 'Choisissez un plan existant.' });
    }
  }

  const before = {
    planId: subscription.planId,
    planName: subscription.plan.name,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
  };

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      planId: input.planId ?? undefined,
      status: input.status ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : undefined,
      trialEndsAt: input.trialEndsAt === undefined ? undefined : input.trialEndsAt ? new Date(input.trialEndsAt) : null,
      // Réactiver ou changer un abonnement annule une résiliation programmée.
      cancelledAt: input.status && input.status !== 'CANCELLED' ? null : undefined,
    },
    include: { plan: { select: { id: true, name: true } } },
  });

  const after = {
    planId: updated.planId,
    planName: updated.plan.name,
    status: updated.status,
    currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
    trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
  };

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    restaurantId: id,
    targetType: 'subscription',
    targetId: subscription.id,
    ip: await currentClientIp(),
    metadata: { changes: diffFields(before, after), reason: input.reason },
  });

  return ok({
    subscription: {
      id: updated.id,
      planId: updated.planId,
      planName: updated.plan.name,
      status: updated.status,
      currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
      trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
    },
  });
});
