import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformMetrics } from '@/lib/analytics';
import { getPlatformStoreMetrics } from '@/lib/boutique/platform-analytics';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Administration' };
export const dynamic = 'force-dynamic';

const SUBSCRIPTION_LABELS: Record<string, string> = {
  TRIALING: 'En essai',
  ACTIVE: 'Actifs',
  PAST_DUE: 'En retard',
  CANCELLED: 'Résiliés',
  EXPIRED: 'Expirés',
};

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
  restaurants: (
    <svg {...ICON_PROPS}>
      <path d="M4 10 5.5 4h13L20 10" />
      <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
      <path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    </svg>
  ),
  active: (
    <svg {...ICON_PROPS}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  users: (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  ),
  new: (
    <svg {...ICON_PROPS}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  orders: (
    <svg {...ICON_PROPS}>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  volume: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15.5c.5 1 1.5 1.5 3 1.5s3-1 3-2.2-1-1.8-3-2.3-3-1.1-3-2.3 1.5-2.2 3-2.2 2.5.5 3 1.5" />
      <path d="M12 6.5v11" />
    </svg>
  ),
  active_subs: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  ),
  expired_subs: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

export default async function AdminDashboardPage() {
  await requireSuperAdmin();

  const [metrics, storeMetrics, recentRestaurants, recentStores, recentLogs] = await Promise.all([
    getPlatformMetrics(),
    getPlatformStoreMetrics(),
    prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        isDemo: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.store.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        isDemo: true,
        _count: { select: { sales: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-white/60">
        État de la plateforme — MagyaPro Restaurant et MagyaPro Boutique.
      </p>

      <h2 className="mt-6 text-lg font-semibold tracking-tight">MagyaPro Restaurant</h2>

      <section
        aria-label="Indicateurs de la plateforme"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStat label="Restaurants" value={String(metrics.restaurants)} icon={STAT_ICONS.restaurants} />
        <AdminStat
          label="Actifs"
          value={String(metrics.activeRestaurants)}
          icon={STAT_ICONS.active}
          tone="success"
          hint={`${metrics.suspendedRestaurants} suspendu${metrics.suspendedRestaurants > 1 ? 's' : ''}`}
        />
        <AdminStat label="Utilisateurs" value={String(metrics.users)} icon={STAT_ICONS.users} tone="info" />
        <AdminStat
          label="Nouveaux (30 j)"
          value={String(metrics.newRestaurants)}
          icon={STAT_ICONS.new}
          hint="Restaurants créés"
        />
        <AdminStat label="Commandes" value={String(metrics.orders)} icon={STAT_ICONS.orders} />
        <AdminStat
          label="Volume traité"
          value={formatMoney(metrics.grossVolume, 'XOF')}
          icon={STAT_ICONS.volume}
          tone="success"
          hint="Toutes commandes, hors annulées"
        />
        <AdminStat
          label="Abonnements actifs"
          icon={STAT_ICONS.active_subs}
          tone="success"
          value={String(
            (metrics.subscriptionsByStatus.ACTIVE ?? 0) +
              (metrics.subscriptionsByStatus.TRIALING ?? 0),
          )}
        />
        <AdminStat
          label="Abonnements expirés"
          icon={STAT_ICONS.expired_subs}
          tone="danger"
          value={String(
            (metrics.subscriptionsByStatus.EXPIRED ?? 0) +
              (metrics.subscriptionsByStatus.CANCELLED ?? 0),
          )}
        />
      </section>

      <p className="mt-3 text-xs text-white/40">
        Le volume traité correspond au montant des commandes passées chez les
        restaurants ; il ne s&apos;agit pas du revenu de Magyapro, qui provient des
        abonnements.
      </p>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">MagyaPro Boutique</h2>
      <p className="mt-1 text-sm text-white/60">État de la plateforme, toutes boutiques confondues.</p>

      <section
        aria-label="Indicateurs Boutique de la plateforme"
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStat label="Boutiques" value={String(storeMetrics.stores)} icon={STAT_ICONS.restaurants} />
        <AdminStat
          label="Actives"
          value={String(storeMetrics.activeStores)}
          icon={STAT_ICONS.active}
          tone="success"
          hint={`${storeMetrics.suspendedStores} suspendue${storeMetrics.suspendedStores > 1 ? 's' : ''}`}
        />
        <AdminStat
          label="Nouvelles (30 j)"
          value={String(storeMetrics.newStores)}
          icon={STAT_ICONS.new}
          hint="Boutiques créées"
        />
        <AdminStat label="Ventes" value={String(storeMetrics.sales)} icon={STAT_ICONS.orders} />
        <AdminStat
          label="Volume traité"
          value={formatMoney(storeMetrics.grossVolume, 'XOF')}
          icon={STAT_ICONS.volume}
          tone="success"
          hint="Toutes ventes, hors annulées"
        />
        <AdminStat
          label="Abonnements actifs"
          icon={STAT_ICONS.active_subs}
          tone="success"
          value={String(
            (storeMetrics.subscriptionsByStatus.ACTIVE ?? 0) +
              (storeMetrics.subscriptionsByStatus.TRIALING ?? 0),
          )}
        />
        <AdminStat
          label="Abonnements expirés"
          icon={STAT_ICONS.expired_subs}
          tone="danger"
          value={String(
            (storeMetrics.subscriptionsByStatus.EXPIRED ?? 0) +
              (storeMetrics.subscriptionsByStatus.CANCELLED ?? 0),
          )}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="dernieres-boutiques">
          <div className="flex items-center justify-between">
            <h2 id="dernieres-boutiques" className="text-sm font-medium">
              Dernières boutiques
            </h2>
            <Link
              href="/admin/boutiques"
              className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
            >
              Tout voir
            </Link>
          </div>

          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {recentStores.length === 0 && (
              <li className="p-3.5 text-sm text-white/50">Aucune boutique pour le moment.</li>
            )}
            {recentStores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/admin/boutiques/${store.id}`}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {store.name}
                      {store.isDemo && <span className="ml-2 text-xs text-white/40">démo</span>}
                    </span>
                    <span className="block truncate text-xs text-white/50">
                      {store.slug} · {store._count.sales} vente{store._count.sales > 1 ? 's' : ''}
                    </span>
                  </span>
                  <StatusPill status={store.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="abonnements-boutique">
          <h2 id="abonnements-boutique" className="text-sm font-medium">
            Répartition des abonnements Boutique
          </h2>
          <ul className="mt-3 space-y-2 rounded-2xl border border-white/10 p-4">
            {Object.entries(SUBSCRIPTION_LABELS).map(([key, label]) => (
              <li key={key} className="flex justify-between text-sm">
                <span className="text-white/60">{label}</span>
                <span className="font-medium">{storeMetrics.subscriptionsByStatus[key] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="derniers-restaurants">
          <div className="flex items-center justify-between">
            <h2 id="derniers-restaurants" className="text-sm font-medium">
              Derniers restaurants
            </h2>
            <Link
              href="/admin/restaurants"
              className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
            >
              Tout voir
            </Link>
          </div>

          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {recentRestaurants.map((restaurant) => (
              <li key={restaurant.id}>
                <Link
                  href={`/admin/restaurants/${restaurant.id}`}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {restaurant.name}
                      {restaurant.isDemo && (
                        <span className="ml-2 text-xs text-white/40">démo</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-white/50">
                      {restaurant.slug} · {restaurant._count.orders} commande
                      {restaurant._count.orders > 1 ? 's' : ''}
                    </span>
                  </span>
                  <StatusPill status={restaurant.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="abonnements">
          <h2 id="abonnements" className="text-sm font-medium">
            Répartition des abonnements
          </h2>
          <ul className="mt-3 space-y-2 rounded-2xl border border-white/10 p-4">
            {Object.entries(SUBSCRIPTION_LABELS).map(([key, label]) => (
              <li key={key} className="flex justify-between text-sm">
                <span className="text-white/60">{label}</span>
                <span className="font-medium">
                  {metrics.subscriptionsByStatus[key] ?? 0}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-medium">Activité récente</h2>
            <Link
              href="/admin/journal"
              className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
            >
              Journal complet
            </Link>
          </div>
          <ul className="mt-3 space-y-2 rounded-2xl border border-white/10 p-4 text-sm">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs text-white/70">{log.action}</span>
                  {log.actorEmail && (
                    <span className="ml-2 text-white/50">{log.actorEmail}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-white/40">
                  {log.createdAt.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

const STAT_ACCENT: Record<'brand' | 'success' | 'warning' | 'danger' | 'info', string> = {
  brand: 'bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

function AdminStat({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactElement;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${STAT_ACCENT[tone]}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${STAT_ACCENT[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 bg-gradient-to-r from-white to-[#ff9a4d] bg-clip-text text-2xl font-bold tracking-tight text-transparent">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-300',
    DRAFT: 'bg-white/10 text-white/60',
    SUSPENDED: 'bg-red-500/15 text-red-300',
  };
  const labels: Record<string, string> = {
    ACTIVE: 'En ligne',
    DRAFT: 'Brouillon',
    SUSPENDED: 'Suspendu',
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ?? styles.DRAFT
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
