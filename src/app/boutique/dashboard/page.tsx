import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import {
  getStoreDashboardMetrics,
  getStorePopularProducts,
  getStoreRevenueSeries,
} from '@/lib/boutique/analytics';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { RevenueChart } from '@/components/dashboard/revenue-chart';

export const metadata: Metadata = { title: "Vue d'ensemble" };
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
  sales: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.6" />
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

export default async function BoutiqueDashboardPage() {
  const context = await requireStore('store:view');
  const currency = context.store.currency;

  const [metrics, series, popular, recentSales] = await Promise.all([
    getStoreDashboardMetrics(context.store.id, '30d'),
    getStoreRevenueSeries(context.store.id, '30d'),
    getStorePopularProducts(context.store.id, '30d', 5),
    prisma.sale.findMany({
      where: { storeId: context.store.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const hasActivity = metrics.salesCount > 0;

  return (
    <>
      <PageHeader
        title={`👋 Bonjour, ${context.store.name}`}
        description={`Votre activité des 30 derniers jours — connecté en tant que ${context.role ? STORE_ROLE_LABELS[context.role] : 'accès support'}.`}
        action={
          <>
            <LinkButton href="/boutique/dashboard/caisse" size="sm">
              Ouvrir la caisse
            </LinkButton>
            <LinkButton href="/boutique/dashboard/ventes" variant="secondary" size="sm">
              Voir les ventes
            </LinkButton>
          </>
        }
      />

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
          label="Ventes"
          value={String(metrics.salesCount)}
          icon={STAT_ICONS.sales}
          hint={
            metrics.salesChange === null
              ? 'Pas de période précédente à comparer'
              : `${metrics.salesChange > 0 ? '+' : ''}${metrics.salesChange} % vs 30 j précédents`
          }
          tone={
            metrics.salesChange === null ? undefined : metrics.salesChange >= 0 ? 'success' : 'danger'
          }
        />
        <StatCard
          label="Panier moyen"
          value={metrics.averageBasket === null ? '—' : formatMoney(metrics.averageBasket, currency)}
          icon={STAT_ICONS.basket}
          tone="info"
          hint={metrics.averageBasket === null ? 'Aucune vente sur la période' : undefined}
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
                Le graphique apparaîtra dès votre première vente.
              </p>
            )}
          </Card>
        </section>

        <section aria-label="Produits les plus vendus">
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {STAT_ICONS.basket}
              </span>
              Produits les plus vendus
            </h2>
            {popular.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">Aucune vente sur la période.</p>
            ) : (
              <ol className="mt-4 space-y-1">
                {popular.map((product, index) => (
                  <li key={product.name} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-ink-muted">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
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

      <section aria-label="Ventes récentes" className="mt-6">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {STAT_ICONS.sales}
              </span>
              Activité récente
            </h2>
            <Link
              href="/boutique/dashboard/ventes"
              className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Tout voir
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Aucune vente pour le moment"
                description="Les ventes réalisées depuis la caisse apparaîtront ici."
                action={
                  <LinkButton href="/boutique/dashboard/caisse" size="sm">
                    Ouvrir la caisse
                  </LinkButton>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-surface-border">
              {recentSales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 px-1 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#ff9a4d] text-xs font-bold text-white">
                      {(sale.customer?.name ?? 'V').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        n°{sale.number} · {sale.customer?.name ?? 'Client de passage'}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {sale.createdAt.toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={sale.status === 'COMPLETED' ? 'success' : 'neutral'}>
                      {sale.status === 'COMPLETED'
                        ? 'Complétée'
                        : sale.status === 'REFUNDED'
                          ? 'Remboursée'
                          : sale.status === 'PARTIALLY_REFUNDED'
                            ? 'Partiellement remboursée'
                            : 'Annulée'}
                    </Badge>
                    <span className="text-sm font-medium">{formatMoney(sale.total, currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
