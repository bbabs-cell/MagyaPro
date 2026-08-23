import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findStoreScopedOrThrow, requireStore } from '@/lib/boutique/store-tenant';
import { storeExpenseSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import type { StoreExpense } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('expenses:manage');
  const { id } = await params;

  await findStoreScopedOrThrow<StoreExpense>('storeExpense', context.store.id, id);
  const input = parseOrThrow(storeExpenseSchema, await readJson(request));

  const expense = await prisma.storeExpense.update({
    where: { id },
    data: {
      label: input.label,
      amount: input.amount,
      category: input.category,
      incurredAt: input.incurredAt,
      notes: input.notes ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_EXPENSE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_expense',
    targetId: expense.id,
    metadata: { label: expense.label, amount: expense.amount },
  });

  return ok({ expense });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('expenses:manage');
  const { id } = await params;

  const expense = await findStoreScopedOrThrow<StoreExpense>('storeExpense', context.store.id, id);
  await prisma.storeExpense.delete({ where: { id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_EXPENSE_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_expense',
    targetId: id,
    metadata: { label: expense.label, amount: expense.amount },
  });

  return ok({ removed: true });
});
