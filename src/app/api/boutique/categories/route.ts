import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeCategorySchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('products:view');

  const categories = await prisma.storeCategory.findMany({
    where: { storeId: store.id },
    orderBy: { position: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return ok({ categories });
});

export const POST = route(async (request) => {
  const context = await requireStore('products:manage');
  await hit(`boutique-categories:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storeCategorySchema, await readJson(request));

  const category = await prisma.storeCategory.create({
    data: {
      storeId: context.store.id,
      name: input.name,
      parentId: input.parentId ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CATEGORY_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_category',
    targetId: category.id,
    metadata: { name: category.name },
  });

  return ok({ category }, 201);
});
