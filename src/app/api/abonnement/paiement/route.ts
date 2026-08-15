import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';
import { createSubscriptionPaymentRequest } from '@/lib/subscription-payments';
import { formatMoney } from '@/lib/money';

const schema = z.object({
  planKey: z.string().min(1).max(40),
  provider: z.enum(['wave_manual', 'orange_money_manual']),
});

/**
 * Démarre une demande de paiement d'abonnement (voie manuelle). Renvoie les
 * instructions de paiement ; le restaurateur dépose ensuite sa preuve via
 * `POST /api/abonnement/paiement/[id]/preuve`.
 */
export const POST = route(async (request) => {
  const context = await requireTenant('subscription:manage');
  const input = parseOrThrow(schema, await readJson(request));

  const { payment, plan, receivingNumber } = await createSubscriptionPaymentRequest({
    restaurantId: context.restaurant.id,
    planKey: input.planKey,
    provider: input.provider,
  });

  return ok(
    {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      amountLabel: formatMoney(payment.amount, payment.currency),
      planName: plan.name,
      receivingNumber,
    },
    201,
  );
});
