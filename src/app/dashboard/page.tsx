import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { formatMoney } from '@/lib/money';
import { getDashboardMetrics, getPopularProducts, getRevenueSeries } from '@/lib/analytics';
import { ORDER_STATUS_LABELS } from '@/lib/orders/service';
import { getEntitlements } from '@/lib/entitlements';
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { ORDER_STATUS_TONES } from '@/components/dashboard/order-status';

export const metadata: Metadata = { title: 'Vue d\'ensemble' };
export const dynamic = 'force-dynamic';

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

const STAT_ICONS = {
  revenue: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15.5c.5 1 1.5 1.5 3 1.5s3-1 3-2.2-1-1.8-3-2.3-3-1.1-3-2.3 1.5-2.2 3-2.2 2.5.5 3 1.5" />
      <path d="M12 6.5v11" />
    </svg>
  ),
  orders: (
    <svg {...ICON_PROPS}>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  basket: (
    <svg {...ICON_PROPS}>
      <path d="M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  customers: (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  ),
};

export default async function DashboardPage() {
  const { restaurant } = await requireTenant('restaurant:view');
  const currency = restaurant.currency;

  const [metrics, series, popular, recentOrders, entitlements] = await Promise.all([
    getDashboardMetrics(restaurant.id, '30d'),
    getRevenueSeries(restaurant.id, '30d'),
    getPopularProducts(restaurant.id, '30d', 5),
    prisma.order.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { placedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        customerName: true,
        placedAt: true,
      },
    }),
    getEntitlements(restaurant.id),
  ]);

  const hasActivity = metrics.ordersCount > 0;

  return (
    <>
      <PageHeader
        title={`👋 Bonjour, ${restaurant.name}`}
        description="Votre activité des 30 derniers jours."
        action={
          <LinkButton href="/dashboard/commandes" variant="secondary" size="sm">
            Voir les commandes
          </LinkButton>
        }
      />

      {/* Alertes réellement actionnables uniquement. */}
      <div className="mb-6 space-y-3">
        {restaurant.status === 'DRAFT' && (
          <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">
                Votre site n&apos;est pas encore publié
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                Publiez-le pour qu&apos;il devienne accessible à vos clients.
              </p>
            </div>
            <LinkButton href="/dashboard/parametres" size="sm" className="shrink-0">
              Publier mon site
            </LinkButton>
          </Card>
        )}

        {!entitlements.isActive && (
          <Card className="flex flex-col gap-3 border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-red-900">
                Abonnement inactif
              </p>
              <p className="mt-0.5 text-sm text-red-800">
                Certaines fonctionnalités sont indisponibles jusqu&apos;à la
                régularisation.
              </p>
            </div>
            <LinkButton href="/dashboard/abonnement" size="sm" className="shrink-0">
              Gérer l&apos;abonnement
            </LinkButton>
          </Card>
        )}

        {metrics.pendingOrders > 0 && (
          <Card className="flex flex-col gap-3 border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-sky-900">
              <span className="font-medium">
                {metrics.pendingOrders} commande{metrics.pendingOrders > 1 ? 's' : ''}
              </span>{' '}
              en cours de traitement.
            </p>
            <LinkButton href="/dashboard/commandes" size="sm" className="shrink-0">
              Traiter maintenant
            </LinkButton>
          </Card>
        )}
      </div>

      <section aria-label="Indicateurs clés" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires"
          value={formatMoney(metrics.revenue, currency)}
          icon={STAT_ICONS.revenue}
          hint={
            metrics.revenueChange === null
              ? 'Pas de période précédente à comparer'
              : `${metrics.revenueChange > 0 ? '+' : ''}${metrics.revenueChange} % vs 30 j précédents`
          }
          tone={
            metrics.revenueChange === null
              ? undefined
              : metrics.revenueChange >= 0
                ? 'success'
                : 'danger'
          }
        />
        <StatCard
          label="Commandes"
          value={String(metrics.ordersCount)}
          icon={STAT_ICONS.orders}
          hint={
            metrics.ordersChange === null
              ? 'Pas de période précédente à comparer'
              : `${metrics.ordersChange > 0 ? '+' : ''}${metrics.ordersChange} % vs 30 j précédents`
          }
          tone={
            metrics.ordersChange === null
              ? undefined
              : metrics.ordersChange >= 0
                ? 'success'
                : 'danger'
          }
        />
        <StatCard
          label="Panier moyen"
          value={
            metrics.averageBasket === null
              ? '—'
              : formatMoney(metrics.averageBasket, currency)
          }
          icon={STAT_ICONS.basket}
          tone="info"
          hint={metrics.averageBasket === null ? 'Aucune commande sur la période' : undefined}
        />
        <StatCard
          label="Nouveaux clients"
          value={String(metrics.newCustomers)}
          icon={STAT_ICONS.customers}
          tone="warning"
          hint="Sur les 30 derniers jours"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section aria-label="Évolution du chiffre d'affaires" className="lg:col-span-2">
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {STAT_ICONS.revenue}
              </span>
              Chiffre d&apos;affaires sur 30 jours
            </h2>
            {hasActivity ? (
              <div className="mt-4">
                <RevenueChart points={series} currency={currency} />
              </div>
            ) : (
              <p className="mt-6 text-sm text-ink-muted">
                Le graphique apparaîtra dès votre première commande.
              </p>
            )}
          </Card>
        </section>

        <section aria-label="Plats les plus commandés">
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {STAT_ICONS.basket}
              </span>
              Plats les plus commandés
            </h2>
            {popular.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Aucune vente sur la période.
              </p>
            ) : (
              <ol className="mt-4 space-y-1">
                {popular.map((product, index) => (
                  <li key={product.name} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-ink-muted">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {product.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink">
                      {product.quantity}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>
      </div>

      <section aria-label="Commandes récentes" className="mt-6">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {STAT_ICONS.orders}
              </span>
              Activité récente
            </h2>
            <Link
              href="/dashboard/commandes"
              className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Tout voir
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Aucune commande pour le moment"
                description="Dès qu'un client passera commande sur votre site, elle apparaîtra ici."
                action={
                  <LinkButton href="/dashboard/menu" size="sm">
                    Compléter mon menu
                  </LinkButton>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-surface-border">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/commandes/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-1 py-3 hover:bg-surface-sunken"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#ff9a4d] text-xs font-bold text-white">
                        {order.customerName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          n°{order.number} · {order.customerName}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {order.placedAt.toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={ORDER_STATUS_TONES[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="text-sm font-medium">
                        {formatMoney(order.total, currency)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
