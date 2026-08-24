import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeCreditPaymentSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { createNotification } from '@/lib/notifications';
import { formatMoney } from '@/lib/money';

type Params = { params: Promise<{ id: string }> };

/** Encaissement d'un remboursement partiel ou total sur le solde à crédit d'un client. */
export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('credits:manage');
  await hit(`boutique-credit-payments:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  const customer = await prisma.storeCustomer.findFirst({
    where: { id, storeId: context.store.id },
  });
  if (!customer) throw new NotFoundError('Client introuvable.');

  const input = parseOrThrow(storeCreditPaymentSchema, await readJson(request));

  if (input.amount > customer.creditBalance) {
    throw new ValidationError('Le montant dépasse le solde dû par ce client.', {
      amount: `Solde actuel : ${customer.creditBalance}.`,
    });
  }

  await prisma.$transaction([
    prisma.storeCreditPayment.create({
      data: {
        storeId: context.store.id,
        customerId: customer.id,
        amount: input.amount,
        note: input.note ?? null,
      },
    }),
    prisma.storeCustomer.update({
      where: { id: customer.id },
      data: { creditBalance: { decrement: input.amount } },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CREDIT_PAYMENT_RECORDED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_customer',
    targetId: customer.id,
    metadata: { amount: input.amount },
  });

  await createNotification({
    storeId: context.store.id,
    type: 'PAYMENT_RECEIVED',
    title: `Paiement reçu : ${customer.name}`,
    body: `${customer.name} a réglé ${formatMoney(input.amount, context.store.currency)} sur son solde à crédit.`,
    href: '/boutique/dashboard/clients',
  });

  return ok({ success: true });
});
