import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformMetrics } from '@/lib/analytics';
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

export default async function AdminDashboardPage() {
  await requireSuperAdmin();

  const [metrics, recentRestaurants, recentLogs] = await Promise.all([
    getPlatformMetrics(),
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
        État de la plateforme, tous restaurants confondus.
      </p>

      <section
        aria-label="Indicateurs de la plateforme"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStat label="Restaurants" value={String(metrics.restaurants)} />
        <AdminStat
          label="Actifs"
          value={String(metrics.activeRestaurants)}
          hint={`${metrics.suspendedRestaurants} suspendu${metrics.suspendedRestaurants > 1 ? 's' : ''}`}
        />
        <AdminStat label="Utilisateurs" value={String(metrics.users)} />
        <AdminStat
          label="Nouveaux (30 j)"
          value={String(metrics.newRestaurants)}
          hint="Restaurants créés"
        />
        <AdminStat label="Commandes" value={String(metrics.orders)} />
        <AdminStat
          label="Volume traité"
          value={formatMoney(metrics.grossVolume, 'XOF')}
          hint="Toutes commandes, hors annulées"
        />
        <AdminStat
          label="Abonnements actifs"
          value={String(
            (metrics.subscriptionsByStatus.ACTIVE ?? 0) +
              (metrics.subscriptionsByStatus.TRIALING ?? 0),
          )}
        />
        <AdminStat
          label="Abonnements expirés"
          value={String(
            (metrics.subscriptionsByStatus.EXPIRED ?? 0) +
              (metrics.subscriptionsByStatus.CANCELLED ?? 0),
          )}
        />
      </section>

      <p className="mt-3 text-xs text-white/40">
        Le volume traité correspond au montant des commandes passées chez les
        restaurants ; il ne s&apos;agit pas du revenu de Magya, qui provient des
        abonnements.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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

function AdminStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
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
