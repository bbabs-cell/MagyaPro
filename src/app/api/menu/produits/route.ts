import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { productSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';
import { uniqueChildSlug } from '@/lib/slug';
import { requireWithinLimit } from '@/lib/entitlements';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async (request) => {
  const { restaurant } = await requireTenant('menu:view');
  const categoryId = new URL(request.url).searchParams.get('categorie');

  const products = await prisma.product.findMany({
    where: {
      restaurantId: restaurant.id,
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ categoryId: 'asc' }, { position: 'asc' }],
    include: {
      category: { select: { id: true, name: true } },
      variants: { orderBy: { position: 'asc' } },
      optionGroups: {
        orderBy: { position: 'asc' },
        include: { options: { orderBy: { position: 'asc' } } },
      },
    },
  });

  return ok({ products });
});

export const POST = route(async (request) => {
  const context = await requireTenant('menu:manage');
  hit(`menu:${context.restaurant.id}`, RATE_LIMITS.write);
  await requireWithinLimit(context.restaurant.id, 'maxProducts');

  const input = parseOrThrow(productSchema, await readJson(request));

  // La catégorie doit appartenir au restaurant : sans ce contrôle, un produit
  // pourrait être rattaché à la catégorie d'un autre tenant.
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, restaurantId: context.restaurant.id },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationError('Catégorie introuvable.', {
      categoryId: 'Choisissez une de vos catégories.',
    });
  }

  if (input.compareAtPrice != null && input.compareAtPrice <= input.price) {
    throw new ValidationError(
      "L'ancien prix doit être supérieur au prix actuel pour afficher une remise.",
      { compareAtPrice: "L'ancien prix doit être supérieur au prix actuel." },
    );
  }

  const slug = await uniqueChildSlug('product', context.restaurant.id, input.name);
  const last = await prisma.product.findFirst({
    where: { restaurantId: context.restaurant.id, categoryId: category.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const product = await prisma.product.create({
    data: {
      restaurantId: context.restaurant.id,
      categoryId: category.id,
      name: input.name,
      slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      costPrice: input.costPrice ?? null,
      isAvailable: input.isAvailable,
      badge: input.badge,
      position: (last?.position ?? -1) + 1,
      nameEn: input.nameEn ?? null,
      nameAr: input.nameAr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      descriptionAr: input.descriptionAr ?? null,
      variants: {
        create: input.variants.map((variant, position) => ({ ...variant, position })),
      },
      optionGroups: {
        create: input.optionGroups.map((group, position) => ({
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          position,
          options: {
            create: group.options.map((option, optionPosition) => ({
              ...option,
              position: optionPosition,
            })),
          },
        })),
      },
    },
    include: {
      variants: true,
      optionGroups: { include: { options: true } },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.MENU_PRODUCT_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'product',
    targetId: product.id,
    metadata: { name: product.name, price: product.price },
  });

  return ok({ product }, 201);
});
