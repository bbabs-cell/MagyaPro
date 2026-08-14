import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { categorySchema } from '@/lib/validation';
import { ConflictError } from '@/lib/errors';
import { uniqueChildSlug } from '@/lib/slug';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('menu:manage');
  const { id } = await params;

  // Charge la catégorie *avec* le filtre tenant : une catégorie d'un autre
  // restaurant produit un 404, jamais une modification.
  const existing = await findScopedOrThrow<{ id: string; name: string }>(
    'category',
    context.restaurant.id,
    id,
  );

  const input = parseOrThrow(categorySchema, await readJson(request));

  const category = await prisma.category.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      slug:
        input.name === existing.name
          ? undefined
          : await uniqueChildSlug('category', context.restaurant.id, input.name, existing.id),
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      isActive: input.isActive,
      nameEn: input.nameEn ?? null,
      nameAr: input.nameAr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      descriptionAr: input.descriptionAr ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.MENU_CATEGORY_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'category',
    targetId: category.id,
  });

  return ok({ category });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('menu:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string; name: string }>(
    'category',
    context.restaurant.id,
    id,
  );

  // Supprimer une catégorie supprimerait ses produits en cascade. On l'interdit
  // tant qu'elle en contient : la perte serait silencieuse et irréversible.
  const productCount = await prisma.product.count({
    where: { categoryId: existing.id },
  });
  if (productCount > 0) {
    throw new ConflictError(
      `Cette catégorie contient ${productCount} produit${productCount > 1 ? 's' : ''}. Déplacez-les ou supprimez-les d'abord.`,
    );
  }

  await prisma.category.delete({ where: { id: existing.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.MENU_CATEGORY_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'category',
    targetId: existing.id,
    metadata: { name: existing.name },
  });

  return ok({ deleted: true });
});
