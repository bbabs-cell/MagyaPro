import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { reorderSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';

/**
 * Réordonne les catégories.
 *
 * Les identifiants reçus sont confrontés à ceux du restaurant : la mise à jour
 * ne porte que sur des catégories vérifiées comme siennes, et la liste doit
 * être complète pour éviter des positions en double.
 */
export const PUT = route(async (request) => {
  const context = await requireTenant('menu:manage');
  const { ids } = parseOrThrow(reorderSchema, await readJson(request));

  const owned = await prisma.category.findMany({
    where: { restaurantId: context.restaurant.id },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((category) => category.id));

  if (ids.length !== ownedIds.size || ids.some((id) => !ownedIds.has(id))) {
    throw new ValidationError(
      "L'ordre envoyé ne correspond pas à vos catégories. Actualisez la page.",
    );
  }

  await prisma.$transaction(
    ids.map((id, position) =>
      prisma.category.update({ where: { id }, data: { position } }),
    ),
  );

  return ok({ ids });
});
