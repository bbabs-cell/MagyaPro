import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeCustomerSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import type { StoreCustomer } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('customers:manage');
  hit(`boutique-customers:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await findStoreScopedOrThrow<StoreCustomer>('storeCustomer', context.store.id, id);
  const input = parseOrThrow(storeCustomerSchema, await readJson(request));

  const customer = await prisma.storeCustomer.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      creditLimit: input.creditLimit,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CUSTOMER_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_customer',
    targetId: customer.id,
  });

  return ok({ customer });
});
