import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { productSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';
import { uniqueChildSlug } from '@/lib/slug';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

/** Mise à jour rapide de la disponibilité, sans réécrire tout le produit. */
const availabilitySchema = z.object({ isAvailable: z.boolean() });

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('menu:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string; name: string }>(
    'product',
    context.restaurant.id,
    id,
  );

  const body = await readJson(request);

  // Le geste le plus fréquent en service — « ce plat est épuisé » — doit
  // pouvoir se faire en un appel, sans renvoyer les options ni les variantes.
  const quick = availabilitySchema.safeParse(body);
  if (quick.success && Object.keys(body as object).length === 1) {
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: { isAvailable: quick.data.isAvailable },
    });
    return ok({ product });
  }

  const input = parseOrThrow(productSchema, body);

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

  // Variantes et options sont remplacées en bloc. Les commandes passées ne
  // sont pas affectées : elles conservent leur propre instantané de noms et de
  // prix (voir `OrderItem`).
  const product = await prisma.$transaction(async (tx) => {
    await tx.productVariant.deleteMany({ where: { productId: existing.id } });
    await tx.productOptionGroup.deleteMany({ where: { productId: existing.id } });

    return tx.product.update({
      where: { id: existing.id },
      data: {
        categoryId: category.id,
        name: input.name,
        slug:
          input.name === existing.name
            ? undefined
            : await uniqueChildSlug('product', context.restaurant.id, input.name, existing.id),
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        isAvailable: input.isAvailable,
        badge: input.badge,
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
  });

  await recordAudit({
    action: AUDIT_ACTIONS.MENU_PRODUCT_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'product',
    targetId: product.id,
  });

  return ok({ product });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('menu:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string; name: string }>(
    'product',
    context.restaurant.id,
    id,
  );

  // Les lignes de commande référençant ce produit passent à `productId: null`
  // (onDelete: SetNull) tout en conservant leur instantané : l'historique et le
  // chiffre d'affaires restent exacts après suppression d'un plat.
  await prisma.product.delete({ where: { id: existing.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.MENU_PRODUCT_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'product',
    targetId: existing.id,
    metadata: { name: existing.name },
  });

  return ok({ deleted: true });
});
