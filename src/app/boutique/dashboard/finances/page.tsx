import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { PERIODS, isPeriodKey, type PeriodKey } from '@/lib/analytics';
import { getStoreDashboardMetrics } from '@/lib/boutique/analytics';
import {
  getStoreCashFlow,
  getStoreCogs,
  getStoreExpensesSummary,
  getStoreProductMargins,
  getStoreReturnsTotal,
  getStoreStockLosses,
} from '@/lib/boutique/finances';
import { Card, PageHeader, StatCard } from '@/components/ui';

export const metadata: Metadata = { title: 'Finances' };
export const dynamic = 'force-dynamic';

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Loyer',
  UTILITIES: 'Charges',
  STAFF: 'Personnel',
  TRANSPORT: 'Transport',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Entretien',
  SUPPLIES: 'Fournitures',
  OTHER: 'Autre',
};

export default async function BoutiqueFinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const context = await requireStore('finances:view');
  const params = await searchParams;
  const period: PeriodKey = params.periode && isPeriodKey(params.periode) ? params.periode : '30d';
  const currency = context.store.currency;

  const [metrics, expensesSummary, cogs, returnsTotal, stockLosses, cashFlow, margins] =
    await Promise.all([
      getStoreDashboardMetrics(context.store.id, period),
      getStoreExpensesSummary(context.store.id, period),
      getStoreCogs(context.store.id, period),
      getStoreReturnsTotal(context.store.id, period),
      getStoreStockLosses(context.store.id, period),
      getStoreCashFlow(context.store.id, period),
      getStoreProductMargins(context.store.id),
    ]);

  const netRevenue = metrics.revenue - returnsTotal;
  const netResult = netRevenue - cogs - expensesSummary.total - stockLosses;

  return (
    <>
      <PageHeader
        title="Finances"
        description="Recettes, coûts, pertes et trésorerie — à partir de vos ventes, dépenses et mouvements de stock réels."
      />

      <nav aria-label="Période" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
          <a
            key={key}
            href={`/boutique/dashboard/finances?periode=${key}`}
            aria-current={period === key ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              period === key ? 'bg-brand text-white' : 'bg-surface text-ink-muted hover:text-ink'
            }`}
          >
            {PERIODS[key].label}
          </a>
        ))}
      </nav>

      <section aria-label="Compte de résultat" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recettes" value={formatMoney(metrics.revenue, currency)} />
        <StatCard
          label="Retours remboursés"
          value={returnsTotal > 0 ? `−${formatMoney(returnsTotal, currency)}` : formatMoney(0, currency)}
        />
        <StatCard label="Coût des marchandises vendues" value={formatMoney(cogs, currency)} />
        <StatCard label="Dépenses" value={formatMoney(expensesSummary.total, currency)} />
        <StatCard
          label="Pertes de stock"
          value={stockLosses > 0 ? `−${formatMoney(stockLosses, currency)}` : formatMoney(0, currency)}
        />
        <div className="card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Bénéfice net</p>
          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              netResult >= 0 ? 'text-state-ok' : 'text-state-bad'
            }`}
          >
            {formatMoney(netResult, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {PERIODS[period].label} · recettes − retours − coût des marchandises − dépenses − pertes
          </p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Trésorerie (espèces)
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              cashFlow.net >= 0 ? 'text-state-ok' : 'text-state-bad'
            }`}
          >
            {formatMoney(cashFlow.net, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {formatMoney(cashFlow.cashIn, currency)} entrées − {formatMoney(cashFlow.cashOut, currency)}{' '}
            sorties
          </p>
        </div>
      </section>

      <Card className="mt-6 p-4 sm:p-5">
        <h2 className="text-sm font-medium">Marge par article</h2>
        {margins.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Renseignez un coût d&apos;achat sur vos produits (dans Produits) pour voir leur marge ici.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Article</th>
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
                    <td
                      className={`py-2 text-right font-medium ${product.margin >= 0 ? 'text-state-ok' : 'text-state-bad'}`}
                    >
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
          <h2 className="text-sm font-medium">
            Dépenses par catégorie — {PERIODS[period].label.toLowerCase()}
          </h2>
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
    </>
  );
}
