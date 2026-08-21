import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeSupplierSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import type { Supplier } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('suppliers:manage');
  hit(`boutique-suppliers:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await findStoreScopedOrThrow<Supplier>('supplier', context.store.id, id);
  const input = parseOrThrow(storeSupplierSchema, await readJson(request));

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: input.name,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      paymentTerms: input.paymentTerms ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_SUPPLIER_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'supplier',
    targetId: supplier.id,
  });

  return ok({ supplier });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('suppliers:manage');
  const { id } = await params;

  await findStoreScopedOrThrow<Supplier>('supplier', context.store.id, id);
  await prisma.supplier.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_SUPPLIER_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'supplier',
    targetId: id,
  });

  return ok({ success: true });
});
