import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { expiresIn } from '@/lib/auth/tokens';

const schema = z.object({ planKey: z.string().min(1).max(40) });

/**
 * Changement de plan Boutique — mêmes règles que l'équivalent Restaurant
 * (`/api/abonnement`) : seuls les plans gratuits changent instantanément ici,
 * un plan payant passe par la demande de paiement.
 */
export const POST = route(async (request) => {
  const context = await requireStore('subscription:manage');
  const { planKey } = parseOrThrow(schema, await readJson(request));

  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.isActive) {
    throw new NotFoundError("Ce plan n'est pas disponible.");
  }
  if (plan.price > 0) {
    throw new ValidationError('Ce plan est payant : passez par la demande de paiement.');
  }

  const existing = await prisma.storeSubscription.findUnique({
    where: { storeId: context.store.id },
  });

  if (existing?.planId === plan.id && existing.status === 'ACTIVE') {
    throw new ValidationError('Vous êtes déjà sur ce plan.');
  }

  const alreadyTrialed = existing !== null && existing.trialEndsAt !== null;
  const trialDays = alreadyTrialed ? 0 : plan.trialDays;
  const periodDays = plan.interval === 'YEAR' ? 365 : 30;

  const subscription = await prisma.storeSubscription.upsert({
    where: { storeId: context.store.id },
    create: {
      storeId: context.store.id,
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
      expiryAlertSentAt: null,
      graceEndsAt: null,
    },
    include: { plan: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_subscription',
    targetId: subscription.id,
    metadata: { from: existing?.planId ?? null, to: plan.key },
  });

  return ok({ subscription });
});

/** Résiliation : l'accès reste ouvert jusqu'à la fin de la période payée. */
export const DELETE = route(async () => {
  const context = await requireStore('subscription:manage');

  const subscription = await prisma.storeSubscription.findUnique({
    where: { storeId: context.store.id },
  });
  if (!subscription) throw new NotFoundError('Aucun abonnement en cours.');

  const updated = await prisma.storeSubscription.update({
    where: { id: subscription.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_subscription',
    targetId: subscription.id,
    metadata: { cancelled: true },
  });

  return ok({ subscription: updated });
});
