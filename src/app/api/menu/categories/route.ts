import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { categorySchema } from '@/lib/validation';
import { uniqueChildSlug } from '@/lib/slug';
import { requireWithinLimit } from '@/lib/entitlements';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('menu:view');

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { position: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return ok({ categories });
});

export const POST = route(async (request) => {
  const context = await requireTenant('menu:manage');
  await hit(`menu:${context.restaurant.id}`, RATE_LIMITS.write);

  // La limite du plan est vérifiée côté serveur, juste avant l'insertion.
  await requireWithinLimit(context.restaurant.id, 'maxCategories');

  const input = parseOrThrow(categorySchema, await readJson(request));
  const slug = await uniqueChildSlug('category', context.restaurant.id, input.name);

  // La nouvelle catégorie se place en fin de liste.
  const last = await prisma.category.findFirst({
    where: { restaurantId: context.restaurant.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const category = await prisma.category.create({
    data: {
      restaurantId: context.restaurant.id,
      name: input.name,
      slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      isActive: input.isActive,
      position: (last?.position ?? -1) + 1,
      nameEn: input.nameEn ?? null,
      nameAr: input.nameAr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      descriptionAr: input.descriptionAr ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.MENU_CATEGORY_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'category',
    targetId: category.id,
    metadata: { name: category.name },
  });

  return ok({ category }, 201);
});
