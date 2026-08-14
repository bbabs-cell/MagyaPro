import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { paymentVerificationSchema } from '@/lib/validation';
import { applyPaymentStatus } from '@/lib/payments/service';

type Params = { params: Promise<{ id: string }> };

/** Validation ou rejet d'une preuve de paiement mobile déposée par le client. */
export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('payments:manage');
  const { id } = await params;
  const input = parseOrThrow(paymentVerificationSchema, await readJson(request));

  const payment = await applyPaymentStatus({
    restaurantId: context.restaurant.id,
    paymentId: id,
    status: input.status,
    failureReason: input.status === 'FAILED' ? (input.failureReason ?? 'Preuve de paiement rejetée.') : null,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
  });

  return ok({ payment });
});
