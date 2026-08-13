import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { tableSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('tables:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'restaurantTable',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(tableSchema, await readJson(request));

  const table = await prisma.restaurantTable.update({
    where: { id: existing.id },
    data: { label: input.label },
  });

  return ok({ table });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('tables:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'restaurantTable',
    context.restaurant.id,
    id,
  );

  await prisma.restaurantTable.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
