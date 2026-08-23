import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeExpenseSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

export const GET = route(async () => {
  const { store } = await requireStore('finances:view');

  const expenses = await prisma.storeExpense.findMany({
    where: { storeId: store.id },
    orderBy: { incurredAt: 'desc' },
    take: 200,
  });

  return ok({ expenses });
});

export const POST = route(async (request) => {
  const context = await requireStore('expenses:manage');

  const input = parseOrThrow(storeExpenseSchema, await readJson(request));

  const expense = await prisma.storeExpense.create({
    data: {
      storeId: context.store.id,
      label: input.label,
      amount: input.amount,
      category: input.category,
      incurredAt: input.incurredAt,
      notes: input.notes ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_EXPENSE_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_expense',
    targetId: expense.id,
    metadata: { label: expense.label, amount: expense.amount, category: expense.category },
  });

  return ok({ expense }, 201);
});
