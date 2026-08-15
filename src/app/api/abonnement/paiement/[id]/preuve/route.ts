import { fail, ok, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { ValidationError } from '@/lib/errors';
import { uploadImage } from '@/lib/storage';
import { attachSubscriptionPaymentProof } from '@/lib/subscription-payments';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

/** Dépose la preuve de paiement sur une demande d'abonnement en attente. */
export const POST = route(async (request, { params }: Params) => {
  const context = await requireTenant('subscription:manage');
  hit(`upload:${context.restaurant.id}`, RATE_LIMITS.upload);
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return fail('Requête de téléversement invalide.', 400, 'VALIDATION_ERROR');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ValidationError('Aucun fichier reçu.');
  }

  const stored = await uploadImage({
    file,
    restaurantId: context.restaurant.id,
    folder: 'subscription-proofs',
  });

  const payment = await attachSubscriptionPaymentProof({
    restaurantId: context.restaurant.id,
    paymentId: id,
    proofUrl: stored.url,
  });

  return ok({ payment });
});
