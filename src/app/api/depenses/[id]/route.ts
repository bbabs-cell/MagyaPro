import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';

type Params = { params: Promise<{ id: string }> };

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('finances:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>('expense', context.restaurant.id, id);
  await prisma.expense.delete({ where: { id: existing.id } });

  return ok({ deleted: true });
});
