import { headers } from 'next/headers';

import { fail, ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { uploadImage } from '@/lib/storage';
import { notifyPaymentProofSubmitted } from '@/lib/notifications';
import { clientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

const MANUAL_MOBILE_MONEY_PROVIDERS = ['orange_money_manual', 'wave_manual'];

type Params = { params: Promise<{ orderId: string }> };

/**
 * Dépôt de la preuve de paiement (capture d'écran) pour un paiement mobile
 * manuel — l'étape qui rend ce moyen de paiement réellement fonctionnel sans
 * intégration API. Route publique : le client n'a pas de compte, donc pas
 * accès au téléversement authentifié du dashboard — celui-ci téléverse
 * directement, scopé par le restaurant de la commande visée.
 */
export const POST = route(async (request, { params }: Params) => {
  const { orderId } = await params;
  const ip = clientIp(await headers()) ?? 'inconnu';

  hit(`payment-proof:ip:${ip}`, RATE_LIMITS.upload);
  hit(`payment-proof:order:${orderId}`, RATE_LIMITS.upload);

  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      provider: { in: MANUAL_MOBILE_MONEY_PROVIDERS },
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { number: true } } },
  });
  if (!payment || !payment.orderId) {
    throw new NotFoundError('Aucun paiement en attente de preuve pour cette commande.');
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return fail('Aucun fichier reçu.', 400, 'VALIDATION_ERROR');
  }

  const stored = await uploadImage({
    file,
    restaurantId: payment.restaurantId,
    folder: 'payment-proofs',
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      proofImageUrl: stored.url,
      proofSubmittedAt: new Date(),
      status: 'PROCESSING',
    },
  });

  await prisma.order.update({
    where: { id: payment.orderId },
    data: { paymentStatus: 'PROCESSING' },
  });

  if (payment.order) {
    await notifyPaymentProofSubmitted(payment.restaurantId, payment.orderId, payment.order.number);
  }

  return ok({ payment: { id: updated.id, status: updated.status } });
});
