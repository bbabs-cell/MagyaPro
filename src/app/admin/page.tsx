import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformMetrics, percentChange } from '@/lib/analytics';
import { getPlatformStoreMetrics } from '@/lib/boutique/platform-analytics';
import { amountIn, getPlatformRevenue, primaryCurrency } from '@/lib/platform-revenue';
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/lib/subscription-labels';
import { formatMoney } from '@/lib/money';
import { mailStatus } from '@/lib/mail/status';
import { MailTestButton } from '@/components/admin/mail-test-button';
import { StatusPill } from '@/components/admin/state-badge';

export const metadata: Metadata = { title: 'Administration' };
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

  const [metrics, storeMetrics, revenue, recentRestaurants, recentStores, recentLogs] = await Promise.all([
    getPlatformMetrics(),
    getPlatformStoreMetrics(),
    getPlatformRevenue(),
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

  // Lecture de variables d'environnement uniquement — aucun accès réseau ni
  // base, donc rien à paralléliser avec les requêtes ci-dessus.
  const mail = mailStatus();

  // Extraits en variables : ces sommes servent deux fois chacune — à
  // l'affichage et à la décision de colorer la carte.
  const expiredRestaurantSubs =
    (metrics.subscriptionsByStatus.EXPIRED ?? 0) + (metrics.subscriptionsByStatus.CANCELLED ?? 0);
  const expiredStoreSubs =
    (storeMetrics.subscriptionsByStatus.EXPIRED ?? 0) +
    (storeMetrics.subscriptionsByStatus.CANCELLED ?? 0);

  // Devise de référence pour l'affichage : celle qui pèse le plus lourd sur
  // l'ensemble des encaissements. Les montants ne sont jamais additionnés
  // entre devises — voir `platform-revenue.ts`.
  const currency = primaryCurrency(revenue.allTime);
  const thisMonth = amountIn(revenue.currentMonth, currency);
  const lastMonth = amountIn(revenue.previousMonth, currency);
  const monthChange = percentChange(lastMonth, thisMonth);
  const peak = Math.max(...revenue.byMonth.map((point) => amountIn(point.byCurrency, currency)), 1);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-white/60">
        État de la plateforme — MagyaPro Restaurant et MagyaPro Boutique.
      </p>

      {/* --- État de l'envoi d'emails ------------------------------------
          Le pilote par défaut est « console » : il écrit l'email dans les
          journaux au lieu de l'envoyer. C'est le bon comportement en
          développement et une panne silencieuse en production — une
          inscription semble réussir, mais le client ne reçoit ni sa
          vérification d'adresse ni son lien de mot de passe oublié. Rien dans
          l'application ne le signalait ; ce bloc existe pour ça. */}
      <section
        aria-label="Envoi des emails"
        className={`mt-6 rounded-2xl border p-4 ${
          mail.delivers ? 'border-white/10 bg-white/5' : 'border-red-500/40 bg-red-500/10'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-medium text-white">
              <span aria-hidden="true">{mail.delivers ? '✓' : '✕'}</span>
              Envoi des emails — pilote{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
                {mail.driver}
              </code>
            </h2>
            <p className={`mt-1.5 text-sm ${mail.delivers ? 'text-white/60' : 'text-red-200'}`}>
              {mail.message}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              {mail.settings.map((setting) => (
                <li key={setting.key}>
                  <span aria-hidden="true">{setting.present ? '✓' : '✕'}</span>{' '}
                  <span className="font-mono">{setting.key}</span>{' '}
                  {setting.present ? 'défini' : 'absent'}
                </li>
              ))}
            </ul>
          </div>
          <MailTestButton />
        </div>
      </section>

      {/* --- Recette réelle de MagyaPro ----------------------------------
          Le chiffre que le propriétaire de la plateforme vient chercher, et
          qui n'était affiché nulle part. Les cartes ci-dessous montrent le
          « volume traité », c'est-à-dire l'argent des commerçants ; les écrans
          d'analyse montrent le MRR, une projection qui suppose que tout le
          monde paie. Ici : les paiements d'abonnement réellement validés. */}
      <section
        aria-labelledby="recette"
        className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="recette" className="text-sm font-medium text-white/70">
              Recette MagyaPro — ce mois-ci
            </h2>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-white">
              {formatMoney(thisMonth, currency)}
            </p>
            {/* La comparaison porte sur la même portion de mois. Le total
                complet du mois précédent est donné à côté, sans être comparé :
                onze jours ne se comparent pas à trente-et-un. */}
            <p className="mt-1 text-xs text-white/50">
              {monthChange === null
                ? `Pas de comparaison possible : rien d’encaissé au ${revenue.comparisonDayOfMonth} du mois dernier.`
                : `${monthChange >= 0 ? '+' : ''}${monthChange} % par rapport au mois dernier à la même date (${formatMoney(lastMonth, currency)} au ${revenue.comparisonDayOfMonth}).`}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              Mois dernier en entier : {formatMoney(amountIn(revenue.previousMonthFull, currency), currency)}.
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-white/40">Restaurant</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-white">
                {formatMoney(amountIn(revenue.currentMonthByProduct.restaurant, currency), currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-white/40">Boutique</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-white">
                {formatMoney(amountIn(revenue.currentMonthByProduct.store, currency), currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-white/40">Depuis le début</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-white">
                {formatMoney(amountIn(revenue.allTime, currency), currency)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Douze mois d'encaissements. Barres rendues côté serveur : aucun
            script à charger pour une lecture d'un coup d'œil. */}
        <div className="mt-5 flex items-end gap-1.5" aria-hidden="true">
          {revenue.byMonth.map((point) => {
            const amount = amountIn(point.byCurrency, currency);
            return (
              <div key={point.month} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-16 w-full items-end">
                  <div
                    className={`w-full rounded-t ${amount > 0 ? 'bg-emerald-500/70' : 'bg-white/10'}`}
                    style={{ height: `${Math.max(2, Math.round((amount / peak) * 100))}%` }}
                  />
                </div>
                <span className="truncate text-[11px] text-white/40">{point.month}</span>
              </div>
            );
          })}
        </div>
        {/* Le graphique est décoratif pour un lecteur d'écran ; la même
            information lui est donnée en toutes lettres. */}
        <p className="sr-only">
          Encaissements des douze derniers mois :{' '}
          {revenue.byMonth
            .map((point) => `${point.month} ${formatMoney(amountIn(point.byCurrency, currency), currency)}`)
            .join(', ')}
          .
        </p>

        {(revenue.pendingCount > 0 || revenue.overdueCount > 0) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-sm">
            {revenue.pendingCount > 0 && (
              <Link
                href="/admin/abonnements"
                className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-amber-200 hover:bg-amber-500/25"
              >
                {revenue.pendingCount} paiement{revenue.pendingCount > 1 ? 's' : ''} à valider
              </Link>
            )}
            {revenue.overdueCount > 0 && (
              <Link
                href="/admin/abonnements?statut=ACTIVE"
                className="rounded-lg bg-red-500/15 px-3 py-1.5 text-red-200 hover:bg-red-500/25"
              >
                {revenue.overdueCount} abonnement{revenue.overdueCount > 1 ? 's' : ''} actif
                {revenue.overdueCount > 1 ? 's' : ''} dont la période est dépassée
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Séparateur franc entre les deux produits : les deux grilles se
          ressemblent trait pour trait, et rien n'indiquait où l'une finissait
          et l'autre commençait. */}
      <div className="mt-10 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold tracking-tight">MagyaPro Restaurant</h2>
        <p className="mt-1 text-sm text-white/60">
          État de la plateforme, tous restaurants confondus.
        </p>
      </div>

      <section
        aria-label="Indicateurs de la plateforme"
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStat label="Restaurants" value={String(metrics.restaurants)} icon={STAT_ICONS.restaurants} />
        <AdminStat
          label="Actifs"
          value={String(metrics.activeRestaurants)}
          icon={STAT_ICONS.active}
          hint={`${metrics.suspendedRestaurants} suspendu${metrics.suspendedRestaurants > 1 ? 's' : ''}`}
          // Ambre seulement s'il y a vraiment quelque chose à regarder.
          tone={metrics.suspendedRestaurants > 0 ? 'warning' : undefined}
        />
        <AdminStat label="Utilisateurs" value={String(metrics.users)} icon={STAT_ICONS.users} />
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
          hint="Toutes commandes, hors annulées"
        />
        <AdminStat
          label="Abonnements actifs"
          icon={STAT_ICONS.active_subs}
          value={String(
            (metrics.subscriptionsByStatus.ACTIVE ?? 0) +
              (metrics.subscriptionsByStatus.TRIALING ?? 0),
          )}
        />
        <AdminStat
          label="Abonnements expirés"
          icon={STAT_ICONS.expired_subs}
          value={String(expiredRestaurantSubs)}
          tone={expiredRestaurantSubs > 0 ? 'danger' : undefined}
        />
      </section>

      <p className="mt-3 text-xs text-white/40">
        Le volume traité correspond au montant des commandes passées chez les
        restaurants ; il ne s&apos;agit pas du revenu de Magyapro, qui provient des
        abonnements.
      </p>

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
            {SUBSCRIPTION_STATUSES.map((key) => (
              <li key={key} className="flex justify-between text-sm">
                <span className="text-white/60">{SUBSCRIPTION_STATUS_LABELS[key]}</span>
                <span className="font-medium">
                  {metrics.subscriptionsByStatus[key] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-10 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold tracking-tight">MagyaPro Boutique</h2>
        <p className="mt-1 text-sm text-white/60">
          État de la plateforme, toutes boutiques confondues.
        </p>
      </div>

      <section
        aria-label="Indicateurs Boutique de la plateforme"
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStat label="Boutiques" value={String(storeMetrics.stores)} icon={STAT_ICONS.restaurants} />
        <AdminStat
          label="Actives"
          value={String(storeMetrics.activeStores)}
          icon={STAT_ICONS.active}
          hint={`${storeMetrics.suspendedStores} suspendue${storeMetrics.suspendedStores > 1 ? 's' : ''}`}
          tone={storeMetrics.suspendedStores > 0 ? 'warning' : undefined}
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
          hint="Toutes ventes, hors annulées"
        />
        <AdminStat
          label="Abonnements actifs"
          icon={STAT_ICONS.active_subs}
          value={String(
            (storeMetrics.subscriptionsByStatus.ACTIVE ?? 0) +
              (storeMetrics.subscriptionsByStatus.TRIALING ?? 0),
          )}
        />
        <AdminStat
          label="Abonnements expirés"
          icon={STAT_ICONS.expired_subs}
          value={String(expiredStoreSubs)}
          tone={expiredStoreSubs > 0 ? 'danger' : undefined}
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
            {SUBSCRIPTION_STATUSES.map((key) => (
              <li key={key} className="flex justify-between text-sm">
                <span className="text-white/60">{SUBSCRIPTION_STATUS_LABELS[key]}</span>
                <span className="font-medium">{storeMetrics.subscriptionsByStatus[key] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>


      {/* Le journal couvre les deux produits : il vit désormais à part,
          sur toute la largeur, au lieu d'être imbriqué dans la colonne
          des abonnements Restaurant où rien ne le rattachait. */}
      <section aria-label="Activité récente" className="mt-10 border-t border-white/10 pt-6">
        <div className="flex items-center justify-between">
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
    </>
  );
}

/**
 * Couleurs d'alerte. Volontairement absentes de la carte par défaut : quand
 * chaque carte porte sa propre couleur, plus aucune ne signifie quoi que ce
 * soit, et celle qui annonce un vrai problème se noie dans les autres.
 */
const STAT_ACCENT: Record<'success' | 'warning' | 'danger', string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

function AdminStat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactElement;
  /**
   * À ne renseigner que lorsque la VALEUR elle-même est un signal — trois
   * abonnements expirés, deux boutiques suspendues. Un compteur ordinaire
   * n'a pas de couleur.
   */
  tone?: 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20">
      {tone ? (
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${STAT_ACCENT[tone]}`} />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/60">
            {icon}
          </span>
        )}
      </div>
      {/* Chiffre en blanc plein : le dégradé précédent était décoratif et
          rendait les grands nombres moins lisibles sur fond sombre. */}
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

