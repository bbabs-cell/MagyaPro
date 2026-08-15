import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { getPlatformSettings } from '@/lib/platform-settings';
import { expiresIn } from '@/lib/auth/tokens';

/**
 * Paiement manuel de l'abonnement plateforme.
 *
 * Même principe que le paiement mobile manuel des commandes : le
 * restaurateur envoie l'argent sur le numéro Wave/Orange Money de la
 * plateforme (réglé par le Super Admin dans `PlatformSettings`), dépose une
 * preuve, le Super Admin valide — ce qui fait passer l'abonnement au plan
 * demandé pour une nouvelle période. Aucun identifiant de fournisseur de
 * paiement n'est requis pour démarrer.
 */

const PROVIDER_LABELS: Record<string, string> = {
  wave_manual: 'Wave',
  orange_money_manual: 'Orange Money',
};

/** Crée une demande de paiement en attente pour le plan choisi. */
export async function createSubscriptionPaymentRequest(params: {
  restaurantId: string;
  planKey: string;
  provider: 'wave_manual' | 'orange_money_manual';
}) {
  const plan = await prisma.plan.findFirst({
    where: { key: params.planKey, isActive: true },
  });
  if (!plan) throw new NotFoundError("Ce plan n'est pas disponible.");
  if (plan.price <= 0) {
    throw new ValidationError('Ce plan est gratuit : aucun paiement requis.');
  }

  const settings = await getPlatformSettings();
  const receivingNumber =
    params.provider === 'wave_manual' ? settings?.waveNumber : settings?.orangeMoneyNumber;
  if (!receivingNumber) {
    throw new ValidationError(
      `${PROVIDER_LABELS[params.provider]} n'est pas encore configuré par Magyapro. Réessayez plus tard.`,
    );
  }

  const pending = await prisma.subscriptionPayment.findFirst({
    where: { restaurantId: params.restaurantId, status: 'PENDING' },
  });
  if (pending) {
    throw new ConflictError(
      'Une demande de paiement est déjà en attente de validation. Patientez ou déposez votre preuve.',
    );
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      restaurantId: params.restaurantId,
      planId: plan.id,
      provider: params.provider,
      amount: plan.price,
      currency: plan.currency,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_REQUESTED,
    restaurantId: params.restaurantId,
    targetType: 'subscription_payment',
    targetId: payment.id,
    metadata: { planKey: plan.key, amount: plan.price, provider: params.provider },
  });

  return { payment, plan, receivingNumber };
}

/** Dépose la preuve de paiement sur une demande en attente du restaurant. */
export async function attachSubscriptionPaymentProof(params: {
  restaurantId: string;
  paymentId: string;
  proofUrl: string;
}) {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: params.paymentId, restaurantId: params.restaurantId },
  });
  if (!payment) throw new NotFoundError('Demande de paiement introuvable.');
  if (payment.status !== 'PENDING') {
    throw new ConflictError('Cette demande a déjà été traitée.');
  }

  return prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: { proofImageUrl: params.proofUrl, proofSubmittedAt: new Date() },
  });
}

/** Approuve la demande : active l'abonnement sur le plan payé pour une nouvelle période. */
export async function approveSubscriptionPayment(params: {
  paymentId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: params.paymentId },
    include: { plan: true },
  });
  if (!payment) throw new NotFoundError('Demande de paiement introuvable.');
  if (payment.status !== 'PENDING') {
    throw new ConflictError('Cette demande a déjà été traitée.');
  }

  const periodDays = payment.plan.interval === 'YEAR' ? 365 : 30;

  await prisma.$transaction([
    prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'APPROVED',
        reviewedByUserId: params.actorUserId ?? null,
        reviewedAt: new Date(),
      },
    }),
    prisma.subscription.upsert({
      where: { restaurantId: payment.restaurantId },
      create: {
        restaurantId: payment.restaurantId,
        planId: payment.planId,
        status: 'ACTIVE',
        currentPeriodEnd: expiresIn(periodDays, 'days'),
      },
      update: {
        planId: payment.planId,
        status: 'ACTIVE',
        cancelledAt: null,
        currentPeriodEnd: expiresIn(periodDays, 'days'),
      },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_APPROVED,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    restaurantId: payment.restaurantId,
    targetType: 'subscription_payment',
    targetId: payment.id,
    metadata: { planKey: payment.plan.key, amount: payment.amount },
  });

  return payment;
}

/** Refuse la demande — le restaurateur devra réessayer ou fournir une nouvelle preuve. */
export async function rejectSubscriptionPayment(params: {
  paymentId: string;
  note?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: params.paymentId } });
  if (!payment) throw new NotFoundError('Demande de paiement introuvable.');
  if (payment.status !== 'PENDING') {
    throw new ConflictError('Cette demande a déjà été traitée.');
  }

  const updated = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: 'REJECTED',
      note: params.note ?? null,
      reviewedByUserId: params.actorUserId ?? null,
      reviewedAt: new Date(),
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_REJECTED,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    restaurantId: payment.restaurantId,
    targetType: 'subscription_payment',
    targetId: payment.id,
    metadata: { note: params.note ?? null },
  });

  return updated;
}
