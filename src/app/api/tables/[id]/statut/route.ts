import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { tableStatusSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/** Changement de statut seul (libre / occupée / à nettoyer) — geste du service. */
export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('tables:view');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'restaurantTable',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(tableStatusSchema, await readJson(request));

  const table = await prisma.restaurantTable.update({
    where: { id: existing.id },
    data: { status: input.status },
  });

  return ok({ table });
});
