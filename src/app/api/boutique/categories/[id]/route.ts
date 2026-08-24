import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore, findStoreScopedOrThrow } from '@/lib/boutique/store-tenant';
import { storeCategorySchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';
import type { StoreCategory } from '@prisma/client';

export const PATCH = route(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-categories:${context.store.id}`, RATE_LIMITS.write);
  const { id } = await params;

  await findStoreScopedOrThrow<StoreCategory>('storeCategory', context.store.id, id);
  const input = parseOrThrow(storeCategorySchema, await readJson(request));

  const category = await prisma.storeCategory.update({
    where: { id },
    data: { name: input.name, parentId: input.parentId ?? null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CATEGORY_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_category',
    targetId: category.id,
  });

  return ok({ category });
});

export const DELETE = route(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireStore('products:manage');
  const { id } = await params;

  await findStoreScopedOrThrow<StoreCategory>('storeCategory', context.store.id, id);
  await prisma.storeCategory.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CATEGORY_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_category',
    targetId: id,
  });

  return ok({ success: true });
});
