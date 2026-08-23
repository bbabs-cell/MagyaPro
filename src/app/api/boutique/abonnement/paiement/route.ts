import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireStore } from '@/lib/boutique/store-tenant';
import { createStoreSubscriptionPaymentRequest } from '@/lib/boutique/subscription-payments';
import { formatMoney } from '@/lib/money';

const schema = z.object({
  planKey: z.string().min(1).max(40),
  provider: z.enum(['wave_manual', 'orange_money_manual']),
  country: z.string().min(1, 'Le pays est requis.').max(60),
});

/**
 * Démarre une demande de paiement d'abonnement Boutique (voie manuelle).
 * La preuve se dépose ensuite via `POST /api/boutique/abonnement/paiement/[id]/preuve`.
 */
export const POST = route(async (request) => {
  const context = await requireStore('subscription:manage');
  const input = parseOrThrow(schema, await readJson(request));

  const { payment, plan, receivingNumber } = await createStoreSubscriptionPaymentRequest({
    storeId: context.store.id,
    planKey: input.planKey,
    provider: input.provider,
    country: input.country,
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
