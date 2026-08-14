import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { expenseSchema } from '@/lib/validation';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('finances:manage');
  const expenses = await prisma.expense.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { incurredAt: 'desc' },
    take: 100,
  });
  return ok({ expenses });
});

export const POST = route(async (request) => {
  const context = await requireTenant('finances:manage');
  const input = parseOrThrow(expenseSchema, await readJson(request));

  const expense = await prisma.expense.create({
    data: {
      restaurantId: context.restaurant.id,
      label: input.label,
      amount: input.amount,
      category: input.category,
      incurredAt: input.incurredAt,
      notes: input.notes ?? null,
    },
  });

  return ok({ expense }, 201);
});
