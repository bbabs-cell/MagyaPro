import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { expiresIn } from '@/lib/auth/tokens';

const schema = z.object({ planKey: z.string().min(1).max(40) });

/**
 * Changement de plan.
 *
 * Aucun encaissement n'a lieu ici : Magyapro n'a pas encore de fournisseur de
 * facturation branché. Le changement est enregistré et journalisé, et
 * l'abonnement démarre une nouvelle période. Le jour où un fournisseur est
 * intégré, c'est cette route qui déclenchera le paiement avant d'appliquer le
 * changement — l'interface et les droits n'auront pas à bouger.
 */
export const POST = route(async (request) => {
  const context = await requireTenant('subscription:manage');
  const { planKey } = parseOrThrow(schema, await readJson(request));

  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.isActive) {
    throw new NotFoundError("Ce plan n'est pas disponible.");
  }

  const existing = await prisma.subscription.findUnique({
    where: { restaurantId: context.restaurant.id },
  });

  if (existing?.planId === plan.id && existing.status === 'ACTIVE') {
    throw new ValidationError('Vous êtes déjà sur ce plan.');
  }

  // Un restaurant qui a déjà consommé sa période d'essai n'en obtient pas une
  // nouvelle en changeant de plan.
  const alreadyTrialed = existing !== null && existing.trialEndsAt !== null;
  const trialDays = alreadyTrialed ? 0 : plan.trialDays;
  const periodDays = plan.interval === 'YEAR' ? 365 : 30;

  const subscription = await prisma.subscription.upsert({
    where: { restaurantId: context.restaurant.id },
    create: {
      restaurantId: context.restaurant.id,
      planId: plan.id,
      status: trialDays > 0 ? 'TRIALING' : 'ACTIVE',
      trialEndsAt: trialDays > 0 ? expiresIn(trialDays, 'days') : null,
      currentPeriodEnd: expiresIn(trialDays > 0 ? trialDays : periodDays, 'days'),
    },
    update: {
      planId: plan.id,
      status: trialDays > 0 ? 'TRIALING' : 'ACTIVE',
      cancelledAt: null,
      currentPeriodEnd: expiresIn(trialDays > 0 ? trialDays : periodDays, 'days'),
    },
    include: { plan: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'subscription',
    targetId: subscription.id,
    metadata: { from: existing?.planId ?? null, to: plan.key },
  });

  return ok({ subscription });
});

/** Résiliation : l'accès reste ouvert jusqu'à la fin de la période payée. */
export const DELETE = route(async () => {
  const context = await requireTenant('subscription:manage');

  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId: context.restaurant.id },
  });
  if (!subscription) throw new NotFoundError('Aucun abonnement en cours.');

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'subscription',
    targetId: subscription.id,
    metadata: { cancelled: true },
  });

  return ok({ subscription: updated });
});
