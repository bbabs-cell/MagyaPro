import { prisma } from '@/lib/db';
import {
  PLATFORM_NOTIFICATION_TYPES,
  createPlatformNotification,
} from '@/lib/platform-notifications';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { getActivePromo, getPlatformSettings } from '@/lib/platform-settings';
import { getGroupPlanKey, getStoreSubscriptionPrice } from '@/lib/boutique/store-pricing';
import { expiresIn } from '@/lib/auth/tokens';
import { createNotification } from '@/lib/notifications';
import { sendMail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';

/**
 * Paiement manuel de l'abonnement Boutique — même mécanique que
 * `src/lib/subscription-payments.ts` (Restaurant), adaptée à
 * `StoreSubscription`/`StoreSubscriptionPayment`, jamais partagée avec lui :
 * la contrainte d'unicité de `StoreSubscription.storeId` interdirait de
 * toute façon le partage direct des fonctions.
 */

const PROVIDER_LABELS: Record<string, string> = {
  wave_manual: 'Wave',
  orange_money_manual: 'Orange Money',
};

export async function createStoreSubscriptionPaymentRequest(params: {
  storeId: string;
  planKey: string;
  provider: 'wave_manual' | 'orange_money_manual';
  country: string;
}) {
  const plan = await prisma.plan.findFirst({
    where: { key: params.planKey, isActive: true, product: 'STORE' },
  });
  if (!plan) throw new NotFoundError("Ce plan n'est pas disponible.");
  if (plan.price <= 0) {
    throw new ValidationError('Ce plan est gratuit : aucun paiement requis.');
  }

  // Toutes les boutiques d'un même compte suivent le plan de la plus
  // ancienne. Contrôle côté serveur et pas seulement dans l'écran : le plan
  // arrive dans le corps de la requête, il ne se vérifie pas tout seul.
  const groupPlanKey = await getGroupPlanKey(params.storeId);
  if (groupPlanKey && groupPlanKey !== plan.key) {
    throw new ValidationError(
      'Toutes vos boutiques suivent le plan de votre boutique principale. Changez-le depuis celle-ci pour le changer partout.',
    );
  }

  const settings = await getPlatformSettings();
  const receivingNumber =
    params.provider === 'wave_manual' ? settings?.waveNumber : settings?.orangeMoneyNumber;
  if (!receivingNumber) {
    throw new ValidationError(
      `${PROVIDER_LABELS[params.provider]} n'est pas encore configuré par Magyapro. Réessayez plus tard.`,
    );
  }

  const pending = await prisma.storeSubscriptionPayment.findFirst({
    where: { storeId: params.storeId, status: 'PENDING' },
  });
  if (pending) {
    throw new ConflictError(
      'Une demande de paiement est déjà en attente de validation. Patientez ou déposez votre preuve.',
    );
  }

  // Majoration des boutiques supplémentaires, recalculée à chaque demande —
  // renouvellements compris. La calculer une seule fois à la création ferait
  // repasser la boutique au tarif plein le mois suivant.
  const price = await getStoreSubscriptionPrice(params.storeId, plan.price);

  let amount = price.amount;
  const promo = await getActivePromo();
  if (promo) {
    const alreadyPaid = await prisma.storeSubscriptionPayment.findFirst({
      where: { storeId: params.storeId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!alreadyPaid) {
      // La remise s'applique sur le montant déjà majoré, pas sur le tarif du
      // plan : une boutique supplémentaire bénéficie de l'offre comme une
      // première, à hauteur de ce qu'elle paie réellement.
      amount = Math.round((price.amount * (100 - promo.discountPercent)) / 100);
    }
  }

  const payment = await prisma.storeSubscriptionPayment.create({
    data: {
      storeId: params.storeId,
      planId: plan.id,
      provider: params.provider,
      country: params.country,
      amount,
      currency: plan.currency,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_REQUESTED,
    storeId: params.storeId,
    targetType: 'store_subscription_payment',
    targetId: payment.id,
    metadata: {
      planKey: plan.key,
      amount,
      provider: params.provider,
      country: params.country,
      // Le rang trace pourquoi le montant diffère du tarif affiché du plan.
      storeRank: price.position.rank,
      surchargePercent: price.percent,
    },
  });

  return { payment, plan, receivingNumber, price };
}

export async function attachStoreSubscriptionPaymentProof(params: {
  storeId: string;
  paymentId: string;
  proofUrl: string;
}) {
  const payment = await prisma.storeSubscriptionPayment.findFirst({
    where: { id: params.paymentId, storeId: params.storeId },
  });
  if (!payment) throw new NotFoundError('Demande de paiement introuvable.');
  if (payment.status !== 'PENDING') {
    throw new ConflictError('Cette demande a déjà été traitée.');
  }

  const updated = await prisma.storeSubscriptionPayment.update({
    where: { id: payment.id },
    data: { proofImageUrl: params.proofUrl, proofSubmittedAt: new Date() },
    include: { store: { select: { name: true } }, plan: { select: { name: true } } },
  });

  // Le dépôt de la preuve est le moment où l'argent est réputé versé : c'est
  // là que le Super Admin a quelque chose à faire. La simple demande de
  // paiement, elle, ne déclenche rien — le commerçant n'a encore rien payé,
  // et alerter deux fois par abonnement noierait le signal utile.
  await createPlatformNotification({
    type: PLATFORM_NOTIFICATION_TYPES.SUBSCRIPTION_PAYMENT,
    title: `Paiement Boutique à valider — ${updated.store.name}`,
    body: `${updated.store.name} a déposé une preuve de paiement de ${formatMoney(updated.amount, updated.currency)} pour le plan ${updated.plan.name}.`,
    href: '/admin/boutique-abonnements',
    metadata: { paymentId: updated.id, storeId: params.storeId, amount: updated.amount },
  });

  return updated;
}

export async function approveStoreSubscriptionPayment(params: {
  paymentId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  const payment = await prisma.storeSubscriptionPayment.findUnique({
    where: { id: params.paymentId },
    include: { plan: true },
  });
  if (!payment) throw new NotFoundError('Demande de paiement introuvable.');
  if (payment.status !== 'PENDING') {
    throw new ConflictError('Cette demande a déjà été traitée.');
  }

  const periodDays = payment.plan.interval === 'YEAR' ? 365 : 30;

  await prisma.$transaction([
    prisma.storeSubscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'APPROVED',
        reviewedByUserId: params.actorUserId ?? null,
        reviewedAt: new Date(),
      },
    }),
    prisma.storeSubscription.upsert({
      where: { storeId: payment.storeId },
      create: {
        storeId: payment.storeId,
        planId: payment.planId,
        status: 'ACTIVE',
        currentPeriodEnd: expiresIn(periodDays, 'days'),
      },
      update: {
        planId: payment.planId,
        status: 'ACTIVE',
        cancelledAt: null,
        currentPeriodEnd: expiresIn(periodDays, 'days'),
        expiryAlertSentAt: null,
        graceEndsAt: null,
      },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_APPROVED,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    storeId: payment.storeId,
    targetType: 'store_subscription_payment',
    targetId: payment.id,
    metadata: { planKey: payment.plan.key, amount: payment.amount },
  });

  return payment;
}

export async function rejectStoreSubscriptionPayment(params: {
  paymentId: string;
  note?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  const payment = await prisma.storeSubscriptionPayment.findUnique({ where: { id: params.paymentId } });
  if (!payment) throw new NotFoundError('Demande de paiement introuvable.');
  if (payment.status !== 'PENDING') {
    throw new ConflictError('Cette demande a déjà été traitée.');
  }

  const updated = await prisma.storeSubscriptionPayment.update({
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
    storeId: payment.storeId,
    targetType: 'store_subscription_payment',
    targetId: payment.id,
    metadata: { note: params.note ?? null },
  });

  return updated;
}

/** Alerte les boutiques dont l'abonnement expire dans 5 jours ou moins. */
export async function sendExpiringStoreSubscriptionAlerts(): Promise<{ notified: number }> {
  const now = new Date();
  const threshold = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const subscriptions = await prisma.storeSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { gt: now, lte: threshold },
      expiryAlertSentAt: null,
    },
    include: {
      plan: { select: { name: true, price: true, currency: true } },
      store: { select: { id: true, name: true, email: true } },
    },
  });

  for (const subscription of subscriptions) {
    const daysLeft = Math.max(
      1,
      Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const dateLabel = subscription.currentPeriodEnd.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    await createNotification({
      storeId: subscription.store.id,
      type: 'SUBSCRIPTION_TRIAL_ENDING',
      title: 'Abonnement bientôt à renouveler',
      body: `Votre abonnement « ${subscription.plan.name} » expire le ${dateLabel} (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Renouvelez-le depuis votre tableau de bord pour éviter toute interruption.`,
      href: '/boutique/dashboard/abonnement',
      metadata: { subscriptionId: subscription.id, daysLeft },
    });

    if (subscription.store.email) {
      await sendMail({
        to: subscription.store.email,
        subject: `Votre abonnement Magyapro Boutique expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        text: `Bonjour,\n\nL'abonnement « ${subscription.plan.name} » (${formatMoney(subscription.plan.price, subscription.plan.currency)}) de ${subscription.store.name} expire le ${dateLabel}.\n\nRenouvelez-le depuis votre tableau de bord (Abonnement) pour que votre boutique reste active sans interruption.\n\nL'équipe Magyapro`,
      });
    }

    await prisma.storeSubscription.update({
      where: { id: subscription.id },
      data: { expiryAlertSentAt: now },
    });
  }

  return { notified: subscriptions.length };
}

const GRACE_PERIOD_DAYS = 3;

/** Fait avancer le cycle de vie des abonnements Boutique expirés — voir l'équivalent Restaurant pour le détail. */
export async function processStoreSubscriptionLifecycle(): Promise<{
  enteredGrace: number;
  expired: number;
}> {
  const now = new Date();

  const expiredWithoutGrace = await prisma.storeSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { lt: now },
      graceEndsAt: null,
    },
    include: { store: { select: { id: true, name: true, email: true } } },
  });

  for (const subscription of expiredWithoutGrace) {
    const graceEndsAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    await prisma.storeSubscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE', graceEndsAt },
    });

    await createNotification({
      storeId: subscription.store.id,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Abonnement expiré',
      body: `Votre abonnement est arrivé à son terme. Vous avez ${GRACE_PERIOD_DAYS} jours pour le renouveler avant de basculer automatiquement sur le plan gratuit.`,
      href: '/boutique/dashboard/abonnement',
      metadata: { subscriptionId: subscription.id },
    });

    if (subscription.store.email) {
      await sendMail({
        to: subscription.store.email,
        subject: 'Votre abonnement Magyapro Boutique est arrivé à son terme',
        text: `Bonjour,\n\nL'abonnement de ${subscription.store.name} est arrivé à son terme. Vous avez ${GRACE_PERIOD_DAYS} jours pour le renouveler depuis votre tableau de bord (Abonnement) avant de basculer automatiquement sur le plan gratuit.\n\nL'équipe Magyapro`,
      });
    }
  }

  const graceExpired = await prisma.storeSubscription.findMany({
    where: { status: 'PAST_DUE', graceEndsAt: { lt: now } },
    include: { store: { select: { id: true, name: true, email: true } } },
  });

  // Le délai de grâce écoulé sans paiement fait expirer l'abonnement.
  // Aucun repli vers un plan gratuit : depuis que l'abonnement est
  // obligatoire, il n'existe plus de plan à 0 F sur lequel retomber, et un
  // compte expiré n'accède plus qu'à sa page de paiement (voir le mur
  // d'abonnement du tableau de bord).
  //
  // Les données ne sont jamais touchées : stock, ventes et clients restent
  // intacts et redeviennent accessibles dès le premier paiement validé.
  let expired = 0;
  for (const subscription of graceExpired) {
    await prisma.storeSubscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED', graceEndsAt: null },
    });
    expired += 1;

    await createNotification({
      storeId: subscription.store.id,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Abonnement expiré',
      body: "Le délai de grâce est écoulé sans renouvellement : l'accès est suspendu jusqu'au règlement. Vos données sont conservées.",
      href: '/boutique/dashboard/abonnement',
      metadata: { subscriptionId: subscription.id },
    });

    const to = subscription.store.email;
    if (to) {
      await sendMail({
        to,
        subject: 'Votre abonnement Magyapro Boutique a expiré',
        text: `Bonjour,\n\nFaute de renouvellement, l'accès de ${subscription.store.name} est suspendu.\n\nVos données — stock, ventes et clients — sont intégralement conservées et redeviennent accessibles dès la validation de votre paiement.\n\nPour reprendre : connectez-vous et choisissez votre plan.\n\nL'équipe Magyapro`,
      });
    }
  }

  return { enteredGrace: expiredWithoutGrace.length, expired };
}
