import { ok, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { cancelStoreSubscriptionPaymentRequest } from '@/lib/boutique/subscription-payments';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

/** Annule une demande de paiement d'abonnement restée sans preuve. */
export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('subscription:manage');
  await hit(`boutique-abonnement:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await cancelStoreSubscriptionPaymentRequest({
    storeId: context.store.id,
    paymentId: id,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
  });
  return ok({ cancelled: true });
});
