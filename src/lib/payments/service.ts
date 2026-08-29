import { randomBytes } from 'node:crypto';
import type { PaymentStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { getProvider } from '@/lib/payments/registry';
import type { PaymentInitResult } from '@/lib/payments/types';
import { PAYMENT_STATUS_LABELS, PAYMENT_TRANSITIONS } from '@/lib/payments/status';
import { redactSecrets, sanitizeFailureReason } from '@/lib/payments/failure';

/**
 * Orchestration des paiements : crée l'enregistrement, délègue au fournisseur,
 * consigne le résultat.
 */

/** Référence lisible et non devinable : MGY-<horodatage>-<aléa>. */
function newReference(): string {
  return `MGY-${Date.now().toString(36).toUpperCase()}-${randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
}

// Statuts et transitions vivent dans un module pur, partagé avec l'interface.
export { PAYMENT_STATUS_LABELS, PAYMENT_TRANSITIONS } from '@/lib/payments/status';

export async function initiatePayment(params: {
  orderId: string;
  restaurantId: string;
  providerId: string;
  returnUrl: string;
}): Promise<{ payment: { id: string; reference: string; status: PaymentStatus } } & PaymentInitResult> {
  const provider = getProvider(params.providerId);
  if (!provider || !provider.isAvailable()) {
    throw new ValidationError("Ce moyen de paiement n'est pas disponible.");
  }

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    include: { restaurant: { select: { name: true } } },
  });
  if (!order) throw new NotFoundError('Commande introuvable.');

  if (
    provider.currencies.length > 0 &&
    !provider.currencies.includes(order.currency.toUpperCase())
  ) {
    throw new ValidationError(
      `${provider.label} n'accepte pas les paiements en ${order.currency}.`,
    );
  }

  const reference = newReference();
  const payment = await prisma.payment.create({
    data: {
      restaurantId: order.restaurantId,
      orderId: order.id,
      customerId: order.customerId,
      provider: provider.id,
      amount: order.total,
      currency: order.currency,
      reference,
      status: 'PENDING',
    },
  });

  let result: PaymentInitResult;
  try {
    result = await provider.initiate({
      reference,
      amount: order.total,
      currency: order.currency,
      orderId: order.id,
      orderNumber: order.number,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurant.name,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      returnUrl: params.returnUrl,
    });
  } catch (error) {
    // L'échec d'initiation est un fait métier : on le persiste plutôt que de
    // laisser un paiement « en attente » qui ne bougera jamais.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        // Nettoyé AVANT écriture, pas seulement avant affichage : un secret
        // qui atteint la base y reste, et une base sauvegardée circule.
        failureReason: sanitizeFailureReason(error),
      },
    });
    throw new ValidationError(
      "Le paiement n'a pas pu être initié. Choisissez un autre moyen de paiement.",
    );
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: result.status,
      providerRef: result.providerRef ?? null,
      metadata: (result.metadata ?? {}) as never,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: result.status, paymentProvider: provider.id },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PAYMENT_INITIATED,
    restaurantId: order.restaurantId,
    targetType: 'payment',
    targetId: updated.id,
    metadata: { provider: provider.id, amount: order.total, orderNumber: order.number },
  });

  return {
    ...result,
    payment: { id: updated.id, reference: updated.reference, status: updated.status },
  };
}

/**
 * Applique un changement de statut à un paiement.
 *
 * Point d'entrée unique, partagé par le dashboard (encaissement manuel) et
 * par les futurs webhooks des fournisseurs.
 */
export async function applyPaymentStatus(params: {
  restaurantId: string;
  paymentId: string;
  status: PaymentStatus;
  providerRef?: string | null;
  failureReason?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  const payment = await prisma.payment.findFirst({
    where: { id: params.paymentId, restaurantId: params.restaurantId },
  });
  if (!payment) throw new NotFoundError('Paiement introuvable.');

  if (payment.status === params.status) return payment;

  if (!PAYMENT_TRANSITIONS[payment.status].includes(params.status)) {
    throw new ConflictError(
      `Un paiement « ${PAYMENT_STATUS_LABELS[payment.status]} » ne peut pas passer à « ${PAYMENT_STATUS_LABELS[params.status]} ».`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: params.status,
        providerRef: params.providerRef ?? undefined,
        // Ce motif-ci est saisi par le restaurateur (« preuve floue »), pas
        // par un fournisseur. Il passe quand même au nettoyage : rien
        // n'empêche d'y coller le message d'erreur reçu par ailleurs.
        failureReason: params.failureReason ? redactSecrets(params.failureReason) : undefined,
      },
    });

    // Le statut de paiement de la commande suit celui de son dernier paiement.
    if (result.orderId) {
      await tx.order.update({
        where: { id: result.orderId },
        data: { paymentStatus: params.status },
      });
    }

    return result;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PAYMENT_STATUS_CHANGED,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    restaurantId: params.restaurantId,
    targetType: 'payment',
    targetId: payment.id,
    metadata: { from: payment.status, to: params.status },
  });

  return updated;
}
