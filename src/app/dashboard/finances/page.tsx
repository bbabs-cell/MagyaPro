import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import { PERIODS, getDashboardMetrics, isPeriodKey, type PeriodKey } from '@/lib/analytics';
import { getAverageRevenuePerWorkedDay, getExpensesSummary, getProductMargins } from '@/lib/finances';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { ExpensesManager } from '@/components/dashboard/expenses-manager';

export const metadata: Metadata = { title: 'Finances' };
export const dynamic = 'force-dynamic';

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  INGREDIENTS: 'Ingrédients',
  STAFF: 'Personnel',
  RENT: 'Loyer',
  UTILITIES: 'Charges',
  OTHER: 'Autre',
};

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const context = await requireTenant('finances:manage');
  const params = await searchParams;
  const period: PeriodKey = params.periode && isPeriodKey(params.periode) ? params.periode : '30d';

  const [today, periodMetrics, avgPerDay, expensesSummary, margins, expenses] = await Promise.all([
    getDashboardMetrics(context.restaurant.id, 'today'),
    getDashboardMetrics(context.restaurant.id, period),
    getAverageRevenuePerWorkedDay(context.restaurant.id, period),
    getExpensesSummary(context.restaurant.id, period),
    getProductMargins(context.restaurant.id),
    prisma.expense.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { incurredAt: 'desc' },
      take: 100,
    }),
  ]);

  const currency = context.restaurant.currency;
  const net = periodMetrics.revenue - expensesSummary.total;

  return (
    <>
      <PageHeader
        title="Finances"
        description="Marge par plat, dépenses et rentabilité — à partir de vos commandes et dépenses réelles."
      />

      <nav aria-label="Période" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
          <a
            key={key}
            href={`/dashboard/finances?periode=${key}`}
            aria-current={period === key ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              period === key ? 'bg-ink text-white' : 'bg-white text-ink-muted hover:text-ink'
            }`}
          >
            {PERIODS[key].label}
          </a>
        ))}
      </nav>

      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires du jour" value={formatMoney(today.revenue, currency)} />
        <StatCard
          label="Moyenne par jour travaillé"
          value={avgPerDay.average === null ? '—' : formatMoney(avgPerDay.average, currency)}
          hint={avgPerDay.average === null ? 'Aucune commande sur la période' : `${avgPerDay.workedDays} jour${avgPerDay.workedDays > 1 ? 's' : ''} travaillé${avgPerDay.workedDays > 1 ? 's' : ''}`}
        />
        <StatCard label="Dépenses" value={formatMoney(expensesSummary.total, currency)} />
        <div className="card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Résultat net
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              net >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatMoney(net, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {PERIODS[period].label} · CA − dépenses
          </p>
        </div>
      </section>

      <Card className="mt-6 p-4 sm:p-5">
        <h2 className="text-sm font-medium">Marge par plat</h2>
        {margins.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Renseignez un coût de revient sur vos plats (dans Menu) pour voir leur marge ici.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Plat</th>
                  <th className="py-2 pr-3 text-right font-medium">Prix</th>
                  <th className="py-2 pr-3 text-right font-medium">Coût</th>
                  <th className="py-2 text-right font-medium">Marge</th>
                </tr>
              </thead>
              <tbody>
                {margins.map((product) => (
                  <tr key={product.id} className="border-t border-surface-border">
                    <td className="py-2 pr-3">{product.name}</td>
                    <td className="py-2 pr-3 text-right">{formatMoney(product.price, currency)}</td>
                    <td className="py-2 pr-3 text-right">{formatMoney(product.costPrice, currency)}</td>
                    <td className={`py-2 text-right font-medium ${product.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatMoney(product.margin, currency)} ({product.marginPercent} %)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {Object.keys(expensesSummary.byCategory).length > 0 && (
        <Card className="mt-6 p-4 sm:p-5">
          <h2 className="text-sm font-medium">Dépenses par catégorie — {PERIODS[period].label.toLowerCase()}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(expensesSummary.byCategory).map(([category, amount]) => (
              <li key={category} className="flex justify-between">
                <span className="text-ink-muted">{EXPENSE_CATEGORY_LABELS[category] ?? category}</span>
                <span className="font-medium">{formatMoney(amount, currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <ExpensesManager
          currency={currency}
          expenses={expenses.map((expense) => ({
            id: expense.id,
            label: expense.label,
            amount: expense.amount,
            category: expense.category,
            incurredAt: expense.incurredAt.toISOString(),
            notes: expense.notes,
          }))}
        />
      </div>
    </>
  );
}
