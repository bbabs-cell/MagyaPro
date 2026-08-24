import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeBrandSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import type { Brand } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-brands:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await findStoreScopedOrThrow<Brand>('brand', context.store.id, id);
  const input = parseOrThrow(storeBrandSchema, await readJson(request));

  const brand = await prisma.brand.update({
    where: { id },
    data: { name: input.name, logoUrl: input.logoUrl ?? null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_BRAND_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'brand',
    targetId: brand.id,
  });

  return ok({ brand });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('products:manage');
  const { id } = await params;

  await findStoreScopedOrThrow<Brand>('brand', context.store.id, id);
  await prisma.brand.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_BRAND_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'brand',
    targetId: id,
  });

  return ok({ success: true });
});
