import type { Metadata } from 'next';

import { requireTenant } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import {
  PERIODS,
  getDashboardMetrics,
  getHourlyActivity,
  getPopularProducts,
  getRevenueSeries,
  isPeriodKey,
  type PeriodKey,
} from '@/lib/analytics';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { HourlyActivityChart } from '@/components/dashboard/hourly-chart';

export const metadata: Metadata = { title: 'Statistiques' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { restaurant } = await requireTenant('analytics:view');
  const params = await searchParams;

  const period: PeriodKey =
    params.periode && isPeriodKey(params.periode) ? params.periode : '30d';

  const [metrics, series, popular, hourly, entitlements] = await Promise.all([
    getDashboardMetrics(restaurant.id, period),
    getRevenueSeries(restaurant.id, period),
    getPopularProducts(restaurant.id, period, 10),
    getHourlyActivity(restaurant.id, period),
    getEntitlements(restaurant.id),
  ]);

  const currency = restaurant.currency;
  const advanced = hasFeature(entitlements, FEATURES.ADVANCED_ANALYTICS);
  const hasData = metrics.ordersCount > 0;

  return (
    <>
      <PageHeader
        title="Statistiques"
        description="Toutes les valeurs sont calculées à partir de vos commandes réelles, hors commandes annulées."
      />

      <nav aria-label="Période" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
          <a
            key={key}
            href={`/dashboard/statistiques?periode=${key}`}
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
        <StatCard label="Commandes" value={String(metrics.ordersCount)} />
        <StatCard
          label="Panier moyen"
          value={
            metrics.averageBasket === null ? '—' : formatMoney(metrics.averageBasket, currency)
          }
          hint={metrics.averageBasket === null ? 'Aucune commande' : undefined}
        />
        <StatCard label="Nouveaux clients" value={String(metrics.newCustomers)} />
      </section>

      {advanced && (
        <section
          aria-label="Audience"
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            label="Visiteurs"
            value={String(metrics.visitors)}
            hint="Visiteurs distincts du site public"
          />
          <StatCard
            label="Taux de conversion"
            value={
              metrics.conversionRate === null ? '—' : `${metrics.conversionRate} %`
            }
            hint={
              metrics.conversionRate === null
                ? 'Aucun visiteur mesuré sur la période'
                : 'Visiteurs ayant commandé'
            }
          />
          <StatCard label="Commandes terminées" value={String(metrics.completedOrders)} />
          <StatCard label="Commandes en cours" value={String(metrics.pendingOrders)} />
        </section>
      )}

      {!hasData ? (
        <div className="mt-6">
          <EmptyState
            title="Pas encore de données"
            description="Vos statistiques apparaîtront dès votre première commande. Rien n'est simulé en attendant."
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
              <h2 className="text-sm font-medium">Plats les plus commandés</h2>
              {popular.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">Aucune vente sur la période.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">
                    Classement des plats par quantité vendue
                  </caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-1.5 font-medium">Plat</th>
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
              <h2 className="text-sm font-medium">Répartition horaire des commandes</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Identifiez vos coups de feu pour ajuster votre organisation.
              </p>
              <div className="mt-4">
                <HourlyActivityChart data={hourly} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {!advanced && (
        <Card className="mt-6 border-dashed p-5">
          <h2 className="text-sm font-medium">Statistiques avancées</h2>
          <p className="mt-1 text-sm text-ink-muted">
            L&apos;audience du site et le taux de conversion sont inclus dans les
            plans supérieurs.
          </p>
        </Card>
      )}
    </>
  );
}
