import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeCustomerSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('customers:view');

  const customers = await prisma.storeCustomer.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
  });

  return ok({ customers });
});

export const POST = route(async (request) => {
  const context = await requireStore('customers:manage');
  hit(`boutique-customers:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storeCustomerSchema, await readJson(request));

  const customer = await prisma.storeCustomer.create({
    data: {
      storeId: context.store.id,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      creditLimit: input.creditLimit,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CUSTOMER_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_customer',
    targetId: customer.id,
    metadata: { name: customer.name },
  });

  return ok({ customer }, 201);
});
