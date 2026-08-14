import { createHmac, timingSafeEqual } from 'node:crypto';

import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { ConflictError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { applyPaymentStatus } from '@/lib/payments/service';
import type { PaymentStatus } from '@prisma/client';

/**
 * Webhook Wave : confirme (ou infirme) un paiement initié via l'API Checkout.
 *
 * La signature est vérifiée avant tout traitement — voir docs.wave.com/webhook.
 * L'en-tête `Wave-Signature` porte `t=<horodatage>,v1=<hmac>`, calculé sur
 * `${t}${corps brut}` avec `WAVE_WEBHOOK_SECRET`. Le corps est lu en texte
 * brut, jamais reformaté par un parseur JSON, car le moindre écart
 * d'espacement invaliderait la signature.
 */

const WAVE_PAYMENT_STATUS: Record<string, PaymentStatus> = {
  succeeded: 'PAID',
  processing: 'PROCESSING',
  cancelled: 'FAILED',
};

function verifySignature(header: string | null, rawBody: string, secret: string): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((segment) => segment.split('=') as [string, string]),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const givenBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== givenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, givenBuffer);
}

export const POST = route(async (request) => {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) {
    // Un webhook reçu sans secret configuré ne peut pas être authentifié :
    // le refuser est plus sûr que de faire confiance à un appelant non vérifié.
    throw new UnauthorizedError('Webhook Wave non configuré sur cette instance.');
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('wave-signature');

  if (!verifySignature(signatureHeader, rawBody, secret)) {
    throw new UnauthorizedError('Signature Wave invalide.');
  }

  let event: {
    type: string;
    data: { id: string; client_reference?: string; payment_status: string };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new ValidationError('Corps de webhook JSON invalide.');
  }

  // Seul l'événement de complétion de session fait progresser un paiement :
  // les autres (ouverture, expiration) ne demandent aucune action de notre part.
  if (event.type !== 'checkout.session.completed') {
    return ok({ ignored: true });
  }

  const status = WAVE_PAYMENT_STATUS[event.data.payment_status];
  if (!status) {
    return ok({ ignored: true });
  }

  // Le paiement est retrouvé par notre référence interne (transmise à Wave
  // comme `client_reference`), avec repli sur l'identifiant de session Wave
  // au cas où elle serait absente d'un événement plus ancien.
  const payment = await prisma.payment.findFirst({
    where: event.data.client_reference
      ? { reference: event.data.client_reference }
      : { providerRef: event.data.id },
  });
  if (!payment) {
    // Un webhook pour un paiement inconnu de cette instance n'est pas une
    // erreur cliente : Wave n'a pas à le savoir, et ne doit pas réessayer indéfiniment.
    return ok({ ignored: true });
  }

  try {
    await applyPaymentStatus({
      restaurantId: payment.restaurantId,
      paymentId: payment.id,
      status,
      providerRef: event.data.id,
    });
  } catch (error) {
    // Une transition impossible (ex. webhook reçu hors ordre, paiement déjà
    // remboursé) n'est pas une erreur à faire retenter à Wave indéfiniment :
    // l'événement est simplement ignoré, l'état actuel du paiement fait foi.
    if (!(error instanceof ConflictError)) throw error;
  }

  return ok({ received: true });
});
