import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { PERIODS, isPeriodKey, type PeriodKey } from '@/lib/analytics';
import {
  getStoreCashRegisterPerformance,
  getStoreDashboardMetrics,
  getStoreEmployeePerformance,
  getStoreHourlyActivity,
  getStorePopularProducts,
  getStoreRevenueSeries,
} from '@/lib/boutique/analytics';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { HourlyActivityChart } from '@/components/dashboard/hourly-chart';

export const metadata: Metadata = { title: 'Statistiques' };
export const dynamic = 'force-dynamic';

/**
 * Statistiques approfondies Boutique — équivalent de `/dashboard/statistiques`
 * (Restaurant), avec sélecteur de période et répartition horaire. Pas de
 * section « avancée » gated par entitlements : Boutique n'a pas (encore) de
 * système de limites/options par plan, donc rien à distinguer ici.
 */
export default async function StoreAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const context = await requireStore('analytics:view');
  const params = await searchParams;

  const period: PeriodKey =
    params.periode && isPeriodKey(params.periode) ? params.periode : '30d';

  const [metrics, series, popular, hourly, employees, cashRegisters] = await Promise.all([
    getStoreDashboardMetrics(context.store.id, period),
    getStoreRevenueSeries(context.store.id, period),
    getStorePopularProducts(context.store.id, period, 10),
    getStoreHourlyActivity(context.store.id, period),
    getStoreEmployeePerformance(context.store.id, period),
    getStoreCashRegisterPerformance(context.store.id, period),
  ]);

  const currency = context.store.currency;
  const hasData = metrics.salesCount > 0;

  return (
    <>
      <PageHeader
        title="Statistiques"
        description="Toutes les valeurs sont calculées à partir de vos ventes réelles, hors ventes annulées."
      />

      <nav aria-label="Période" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
          <a
            key={key}
            href={`/boutique/dashboard/statistiques?periode=${key}`}
            aria-current={period === key ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              period === key ? 'bg-brand text-white' : 'bg-surface text-ink-muted hover:text-ink'
            }`}
          >
            {PERIODS[key].label}
          </a>
        ))}
      </nav>

      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires"
          value={formatMoney(metrics.revenue, currency)}
          hint={
            metrics.revenueChange === null
              ? 'Aucune donnée sur la période précédente'
              : `${metrics.revenueChange > 0 ? '+' : ''}${metrics.revenueChange} %`
          }
          tone={
            metrics.revenueChange === null
              ? undefined
              : metrics.revenueChange >= 0
                ? 'success'
                : 'danger'
          }
        />
        <StatCard label="Ventes" value={String(metrics.salesCount)} />
        <StatCard
          label="Panier moyen"
          value={
            metrics.averageBasket === null ? '—' : formatMoney(metrics.averageBasket, currency)
          }
          hint={metrics.averageBasket === null ? 'Aucune vente' : undefined}
        />
        <StatCard label="Nouveaux clients" value={String(metrics.newCustomers)} />
      </section>

      {!hasData ? (
        <div className="mt-6">
          <EmptyState
            title="Pas encore de données"
            description="Vos statistiques apparaîtront dès votre première vente. Rien n'est simulé en attendant."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-medium">
              Chiffre d&apos;affaires — {PERIODS[period].label.toLowerCase()}
            </h2>
            <div className="mt-4">
              <RevenueChart points={series} currency={currency} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">Produits les plus vendus</h2>
              {popular.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">Aucune vente sur la période.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">
                    Classement des produits par quantité vendue
                  </caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-1.5 font-medium">Produit</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Qté</th>
                      <th scope="col" className="py-1.5 text-right font-medium">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popular.map((product) => (
                      <tr key={product.name} className="border-t border-surface-border">
                        <td className="py-2 pr-2">{product.name}</td>
                        <td className="py-2 text-right">{product.quantity}</td>
                        <td className="py-2 text-right font-medium">
                          {formatMoney(product.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">Répartition horaire des ventes</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Identifiez vos coups de feu pour ajuster votre organisation.
              </p>
              <div className="mt-4">
                <HourlyActivityChart data={hourly} />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">Performance par employé</h2>
              {employees.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Aucune vente rattachée à un compte sur la période.
                </p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">Ventes et chiffre d&apos;affaires par employé</caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-1.5 font-medium">Employé</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Ventes</th>
                      <th scope="col" className="py-1.5 text-right font-medium">CA</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Panier moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.userId} className="border-t border-surface-border">
                        <td className="py-2 pr-2">{employee.name}</td>
                        <td className="py-2 text-right">{employee.salesCount}</td>
                        <td className="py-2 text-right font-medium">
                          {formatMoney(employee.revenue, currency)}
                        </td>
                        <td className="py-2 text-right">
                          {formatMoney(employee.averageBasket, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-medium">Performance par caisse</h2>
              {cashRegisters.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Aucune vente rattachée à une session de caisse sur la période.
                </p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">Ventes et chiffre d&apos;affaires par caisse</caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-1.5 font-medium">Caisse</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Ventes</th>
                      <th scope="col" className="py-1.5 text-right font-medium">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRegisters.map((register) => (
                      <tr key={register.cashRegisterId} className="border-t border-surface-border">
                        <td className="py-2 pr-2">{register.name}</td>
                        <td className="py-2 text-right">{register.salesCount}</td>
                        <td className="py-2 text-right font-medium">
                          {formatMoney(register.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
