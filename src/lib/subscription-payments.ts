import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { getActivePromo, getPlatformSettings } from '@/lib/platform-settings';
import { expiresIn } from '@/lib/auth/tokens';
import { createNotification } from '@/lib/notifications';
import { sendMail } from '@/lib/mail';
import { sendSms } from '@/lib/sms';
import { formatMoney } from '@/lib/money';

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
  country: string;
}) {
  const plan = await prisma.plan.findFirst({
    where: { key: params.planKey, isActive: true, product: 'RESTAURANT' },
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

  // Offre de lancement : uniquement sur le tout premier paiement du
  // restaurant, tant que l'offre est en cours — un abonné qui renouvelle ne
  // doit pas la recevoir indéfiniment.
  let amount = plan.price;
  const promo = await getActivePromo();
  if (promo) {
    const alreadyPaid = await prisma.subscriptionPayment.findFirst({
      where: { restaurantId: params.restaurantId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!alreadyPaid) {
      amount = Math.round((plan.price * (100 - promo.discountPercent)) / 100);
    }
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      restaurantId: params.restaurantId,
      planId: plan.id,
      provider: params.provider,
      country: params.country,
      amount,
      currency: plan.currency,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_REQUESTED,
    restaurantId: params.restaurantId,
    targetType: 'subscription_payment',
    targetId: payment.id,
    metadata: { planKey: plan.key, amount, provider: params.provider, country: params.country },
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
        // La nouvelle période repousse l'échéance : l'alerte des 5 jours
        // devra pouvoir se redéclencher pour cette nouvelle date, et un
        // éventuel délai de grâce en cours n'a plus lieu d'être.
        expiryAlertSentAt: null,
        graceEndsAt: null,
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

/**
 * Alerte les restaurateurs dont l'abonnement expire dans 5 jours ou moins —
 * notification en dashboard + email. `expiryAlertSentAt` évite de la
 * renvoyer chaque jour ; elle est remise à zéro à chaque renouvellement
 * (voir `approveSubscriptionPayment`) pour que la prochaine échéance
 * redéclenche l'alerte.
 */
export async function sendExpiringSubscriptionAlerts(): Promise<{ notified: number }> {
  const now = new Date();
  const threshold = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { gt: now, lte: threshold },
      expiryAlertSentAt: null,
    },
    include: {
      plan: { select: { name: true, price: true, currency: true } },
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          settings: { select: { notificationEmail: true } },
        },
      },
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
      restaurantId: subscription.restaurant.id,
      type: 'SUBSCRIPTION_TRIAL_ENDING',
      title: 'Abonnement bientôt à renouveler',
      body: `Votre abonnement « ${subscription.plan.name} » expire le ${dateLabel} (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Renouvelez-le depuis votre tableau de bord pour éviter toute interruption.`,
      href: '/dashboard/abonnement',
      metadata: { subscriptionId: subscription.id, daysLeft },
    });

    const recipient = subscription.restaurant.settings?.notificationEmail ?? subscription.restaurant.email;
    if (recipient) {
      await sendMail({
        to: recipient,
        subject: `Votre abonnement Magyapro expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        text: `Bonjour,\n\nL'abonnement « ${subscription.plan.name} » (${formatMoney(subscription.plan.price, subscription.plan.currency)}) de ${subscription.restaurant.name} expire le ${dateLabel}.\n\nRenouvelez-le depuis votre tableau de bord (Abonnement) pour que votre site reste actif sans interruption.\n\nL'équipe Magyapro`,
      });
    }

    if (subscription.restaurant.phone) {
      await sendSms(
        subscription.restaurant.phone,
        `Magyapro : votre abonnement « ${subscription.plan.name} » expire le ${dateLabel} (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Renouvelez-le depuis votre tableau de bord.`,
      );
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { expiryAlertSentAt: now },
    });
  }

  return { notified: subscriptions.length };
}

const GRACE_PERIOD_DAYS = 3;

/**
 * Fait avancer le cycle de vie des abonnements expirés :
 *
 * 1. Une période qui vient de s'écouler (statut encore ACTIVE/TRIALING)
 *    passe en `PAST_DUE` avec un délai de grâce de 3 jours pour renouveler.
 * 2. Un délai de grâce écoulé sans renouvellement fait passer l'abonnement
 *    en `EXPIRED`. L'accès se réduit alors à la page de paiement : depuis que
 *    l'abonnement est obligatoire, il n'existe plus de plan gratuit sur
 *    lequel retomber.
 *
 * Un renouvellement (paiement approuvé ou changement de plan gratuit)
 * réinitialise `graceEndsAt`, donc un restaurant qui règle pendant le délai
 * de grâce sort normalement de ce cycle.
 */
export async function processSubscriptionLifecycle(): Promise<{
  enteredGrace: number;
  expired: number;
}> {
  const now = new Date();

  const expiredWithoutGrace = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { lt: now },
      graceEndsAt: null,
    },
    include: { restaurant: { select: { id: true, name: true, email: true, settings: { select: { notificationEmail: true } } } } },
  });

  for (const subscription of expiredWithoutGrace) {
    const graceEndsAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE', graceEndsAt },
    });

    await createNotification({
      restaurantId: subscription.restaurant.id,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Abonnement expiré',
      body: `Votre abonnement est arrivé à son terme. Vous avez ${GRACE_PERIOD_DAYS} jours pour le renouveler avant de basculer automatiquement sur le plan gratuit.`,
      href: '/dashboard/abonnement',
      metadata: { subscriptionId: subscription.id },
    });

    const recipient = subscription.restaurant.settings?.notificationEmail ?? subscription.restaurant.email;
    if (recipient) {
      await sendMail({
        to: recipient,
        subject: 'Votre abonnement Magyapro est arrivé à son terme',
        text: `Bonjour,\n\nL'abonnement de ${subscription.restaurant.name} est arrivé à son terme. Vous avez ${GRACE_PERIOD_DAYS} jours pour le renouveler depuis votre tableau de bord (Abonnement) avant de basculer automatiquement sur le plan gratuit.\n\nL'équipe Magyapro`,
      });
    }
  }

  const graceExpired = await prisma.subscription.findMany({
    where: { status: 'PAST_DUE', graceEndsAt: { lt: now } },
    include: { restaurant: { select: { id: true, name: true, email: true, settings: { select: { notificationEmail: true } } } } },
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
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED', graceEndsAt: null },
    });
    expired += 1;

    await createNotification({
      restaurantId: subscription.restaurant.id,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Abonnement expiré',
      body: "Le délai de grâce est écoulé sans renouvellement : l'accès est suspendu jusqu'au règlement. Vos données sont conservées.",
      href: '/dashboard/abonnement',
      metadata: { subscriptionId: subscription.id },
    });

    const to = subscription.restaurant.settings?.notificationEmail ?? subscription.restaurant.email;
    if (to) {
      await sendMail({
        to,
        subject: 'Votre abonnement Magyapro a expiré',
        text: `Bonjour,\n\nFaute de renouvellement, l'accès de ${subscription.restaurant.name} est suspendu.\n\nVos données — stock, ventes et clients — sont intégralement conservées et redeviennent accessibles dès la validation de votre paiement.\n\nPour reprendre : connectez-vous et choisissez votre plan.\n\nL'équipe Magyapro`,
      });
    }
  }

  return { enteredGrace: expiredWithoutGrace.length, expired };
}
