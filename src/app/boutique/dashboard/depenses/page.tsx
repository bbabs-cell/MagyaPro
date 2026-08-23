import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { ExpensesManager } from '@/components/boutique/expenses-manager';

export const metadata: Metadata = { title: 'Dépenses' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueExpensesPage() {
  const context = await requireStore('finances:view');

  const expenses = await prisma.storeExpense.findMany({
    where: { storeId: context.store.id },
    orderBy: { incurredAt: 'desc' },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Loyer, charges, fournitures... tout ce qui sort de la caisse en dehors des achats de stock."
      />

      <ExpensesManager
        initialExpenses={expenses.map((e) => ({
          id: e.id,
          label: e.label,
          amount: e.amount,
          category: e.category,
          incurredAt: e.incurredAt.toISOString(),
          notes: e.notes,
        }))}
        currency={context.store.currency}
        canManage={context.permissions.has('expenses:manage')}
      />
    </>
  );
}
