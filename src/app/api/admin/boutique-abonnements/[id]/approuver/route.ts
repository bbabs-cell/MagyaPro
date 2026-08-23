import { ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { approveStoreSubscriptionPayment } from '@/lib/boutique/subscription-payments';

type Params = { params: Promise<{ id: string }> };

/** Valide une demande de paiement d'abonnement Boutique : active le plan payé. */
export const POST = route(async (_request, { params }: Params) => {
  const user = await requireSuperAdmin();
  const { id } = await params;

  const payment = await approveStoreSubscriptionPayment({
    paymentId: id,
    actorUserId: user.id,
    actorEmail: user.email,
  });

  return ok({ payment });
});
