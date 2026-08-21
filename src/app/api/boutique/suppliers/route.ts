import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeSupplierSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('suppliers:view');

  const suppliers = await prisma.supplier.findMany({
    where: { storeId: store.id },
    orderBy: { name: 'asc' },
  });

  return ok({ suppliers });
});

export const POST = route(async (request) => {
  const context = await requireStore('suppliers:manage');
  hit(`boutique-suppliers:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storeSupplierSchema, await readJson(request));

  const supplier = await prisma.supplier.create({
    data: {
      storeId: context.store.id,
      name: input.name,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      paymentTerms: input.paymentTerms ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_SUPPLIER_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'supplier',
    targetId: supplier.id,
    metadata: { name: supplier.name },
  });

  return ok({ supplier }, 201);
});
