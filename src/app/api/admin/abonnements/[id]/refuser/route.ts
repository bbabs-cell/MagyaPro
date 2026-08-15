import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { rejectSubscriptionPayment } from '@/lib/subscription-payments';

const schema = z.object({ note: z.string().max(300).optional() });

type Params = { params: Promise<{ id: string }> };

/** Refuse une demande de paiement d'abonnement. */
export const POST = route(async (request, { params }: Params) => {
  const user = await requireSuperAdmin();
  const { id } = await params;
  const input = parseOrThrow(schema, await readJson(request).catch(() => ({})));

  const payment = await rejectSubscriptionPayment({
    paymentId: id,
    note: input.note,
    actorUserId: user.id,
    actorEmail: user.email,
  });

  return ok({ payment });
});
