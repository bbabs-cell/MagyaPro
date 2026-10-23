import Link from 'next/link';
import { auditActionLabel } from '@/lib/audit-labels';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformMetrics, percentChange } from '@/lib/analytics';
import { getPlatformStoreMetrics } from '@/lib/boutique/platform-analytics';
import { getPlatformRevenue } from '@/lib/platform-revenue';
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
  type StateTone,
} from '@/lib/subscription-labels';
import {
  amountIn,
  formatMoney,
  hasSeveralCurrencies,
  primaryCurrency,
  type MoneyByCurrency,
} from '@/lib/money';
import { mailStatus } from '@/lib/mail/status';
import { MailTestButton } from '@/components/admin/mail-test-button';
import { RecentAccounts } from '@/components/admin/recent-accounts';
import { formatPercent } from '@/lib/numbers';
import { CountUp } from '@/components/admin/count-up';
import { DOMAIN_CHIP, DomainHeading, DomainPanel, type AdminDomain } from '@/components/admin/domain';

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

/**
 * Volume affiché sur une carte de synthèse.
 *
 * Une carte ne porte qu'un chiffre. Tant qu'une seule devise circule, c'est
 * celle-là ; dès qu'il y en a plusieurs, la carte montre la dominante et
 * l'infobulle énumère le reste — **jamais** une somme des deux, qui serait un
 * nombre sans signification affiché comme s'il en avait une.
 */
function volumeValue(amounts: MoneyByCurrency): string {
  const currency = primaryCurrency(amounts);
  return formatMoney(amountIn(amounts, currency), currency);
}

function volumeHint(amounts: MoneyByCurrency, base: string): string {
  if (!hasSeveralCurrencies(amounts)) return base;
  const currency = primaryCurrency(amounts);
  const others = Object.keys(amounts)
    .filter((code) => code !== currency && amounts[code] !== 0)
    .map((code) => formatMoney(amounts[code]!, code))
    .join(' · ');
  return `${base} · aussi ${others}`;
}

export default async function AdminDashboardPage() {
  await requireSuperAdmin();

  const [
    metrics,
    storeMetrics,
    revenue,
    recentRestaurants,
    recentStores,
    recentLogs,
    pendingDomains,
  ] = await Promise.all([
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
        isTest: true,
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
        isTest: true,
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
    // Domaines dont le restaurateur a prouvé la propriété, mais qui restent à
    // déclarer chez l'hébergeur. Sans cette lecture, sa demande n'aurait aucun
    // endroit où atterrir.
    prisma.domain.findMany({
      where: { type: 'CUSTOM', status: 'VERIFIED' },
      orderBy: { verifiedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        hostname: true,
        verifiedAt: true,
        restaurant: { select: { name: true } },
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
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
          <p className="mt-1 text-sm text-fg/60">
            État de la plateforme — MagyaPro Restaurant et MagyaPro Boutique.
          </p>
        </div>
        {/* Le point vert dit un fait : ces chiffres viennent d'être lus en
            base, à l'heure indiquée. Son halo bat doucement, comme un signe
            de vie — coupé pour qui demande moins d'animations. */}
        <p className="flex items-center gap-2 rounded-full border border-fg/10 bg-fg/5 px-3 py-1 text-xs text-fg/70">
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-state-ok opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-state-ok" />
          </span>
          Données à jour ·{' '}
          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })}
        </p>
      </div>

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
          mail.delivers ? 'border-fg/10 bg-fg/5' : 'border-red-500/40 bg-red-500/10'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-medium text-fg">
              {/* Icône rose : les emails sont de la communication. Le ✓ / ✕
                  qui suit, lui, dit l'état. */}
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-domain-comm/15 text-domain-comm"
              >
                <svg {...ICON_PROPS}>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </span>
              <span aria-hidden="true" className={mail.delivers ? 'text-state-ok' : 'text-state-bad'}>
                {mail.delivers ? '✓' : '✕'}
              </span>
              Envoi des emails — pilote{' '}
              <code className="rounded bg-canvas/60 px-1.5 py-0.5 font-mono text-xs">
                {mail.driver}
              </code>
            </h2>
            <p className={`mt-1.5 text-sm ${mail.delivers ? 'text-fg/60' : 'text-state-bad'}`}>
              {mail.message}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg/60">
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

      {/* --- Domaines à activer chez l'hébergeur -------------------------
          Un domaine vérifié prouve que le restaurateur en est propriétaire.
          Il ne suffit pas à rendre le site joignable : l'adresse doit encore
          être déclarée chez l'hébergeur, ce que MagyaPro ne fait pas
          automatiquement. L'écran du restaurateur l'invite à écrire ; sans
          cette liste, la demande n'aurait aucun endroit où atterrir. */}
      {pendingDomains.length > 0 && (
        <section
          aria-labelledby="domaines-a-activer"
          className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <h2 id="domaines-a-activer" className="text-sm font-medium text-fg">
            {pendingDomains.length} domaine{pendingDomains.length > 1 ? 's' : ''} vérifié
            {pendingDomains.length > 1 ? 's' : ''}, à déclarer chez l&apos;hébergeur
          </h2>
          <p className="mt-1 text-sm text-state-warn/80">
            Le propriétaire a prouvé qu&apos;il possède l&apos;adresse et a créé ses
            enregistrements DNS. Tant qu&apos;elle n&apos;est pas ajoutée au projet chez
            l&apos;hébergeur, elle ne sert à rien et le certificat de sécurité n&apos;est pas
            émis.
          </p>
          <ul className="mt-3 divide-y divide-fg/10 rounded-xl border border-fg/10">
            {pendingDomains.map((domain) => (
              <li
                key={domain.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3 text-sm"
              >
                <span className="font-mono">{domain.hostname}</span>
                <span className="text-fg/60">{domain.restaurant.name}</span>
                <span className="text-fg/60">
                  vérifié le{' '}
                  {domain.verifiedAt?.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Recette réelle de MagyaPro ----------------------------------
          Le chiffre que le propriétaire de la plateforme vient chercher, et
          qui n'était affiché nulle part. Les cartes ci-dessous montrent le
          « volume traité », c'est-à-dire l'argent des commerçants ; les écrans
          d'analyse montrent le MRR, une projection qui suppose que tout le
          monde paie. Ici : les paiements d'abonnement réellement validés. */}
      <section
        aria-labelledby="recette"
        // Violet : la recette de MagyaPro, ce sont les abonnements payés.
        className="relative mt-6 overflow-hidden rounded-2xl border border-domain-abo/25 bg-domain-abo/[0.06] p-5"
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-domain-abo/70" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <DomainHeading id="recette" domain="abo" className="text-sm font-medium text-fg/75">
              Recette MagyaPro — ce mois-ci
            </DomainHeading>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-fg">
              {formatMoney(thisMonth, currency)}
            </p>
            {/* La comparaison porte sur la même portion de mois. Le total
                complet du mois précédent est donné à côté, sans être comparé :
                onze jours ne se comparent pas à trente-et-un. */}
            {monthChange !== null && (
              <p
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                  monthChange >= 0 ? 'bg-emerald-500/15 text-state-ok' : 'bg-red-500/15 text-state-bad'
                }`}
              >
                <span aria-hidden="true">{monthChange >= 0 ? '↗' : '↘'}</span>
                {formatPercent(monthChange, { signed: true })}
              </p>
            )}
            <p className="mt-1 text-xs text-fg/60">
              {monthChange === null
                ? `Pas de comparaison possible : rien d’encaissé au ${revenue.comparisonDayOfMonth} du mois dernier.`
                : `${formatPercent(monthChange, { signed: true })} par rapport au mois dernier à la même date (${formatMoney(lastMonth, currency)} au ${revenue.comparisonDayOfMonth}).`}
            </p>
            <p className="mt-0.5 text-xs text-fg/60">
              Mois dernier en entier : {formatMoney(amountIn(revenue.previousMonthFull, currency), currency)}.
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-fg/60">Restaurant</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-fg">
                {formatMoney(amountIn(revenue.currentMonthByProduct.restaurant, currency), currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-fg/60">Boutique</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-fg">
                {formatMoney(amountIn(revenue.currentMonthByProduct.store, currency), currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-fg/60">Depuis le début</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-fg">
                {formatMoney(amountIn(revenue.allTime, currency), currency)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Douze mois d'encaissements. Barres rendues côté serveur : aucun
            script à charger pour une lecture d'un coup d'œil. */}
        <div className="mt-5 flex items-end gap-1.5" aria-hidden="true">
          {revenue.byMonth.map((point, index) => {
            const amount = amountIn(point.byCurrency, currency);
            return (
              // `min-w-0` : sans lui, la largeur plancher d'une colonne flex
              // est celle de son contenu, donc du libellé « avr. 26 ». Les
              // douze colonnes ne pouvaient pas se comprimer et le graphique
              // débordait de 217 px sur un écran de 320. `truncate` restait
              // inopérant pour la même raison. Mesuré, puis remesuré.
              <div
                key={point.month}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                <div className="flex h-16 w-full items-end">
                  <div
                    className={`w-full origin-bottom animate-grow-up rounded-t ${amount > 0 ? 'bg-domain-abo/75' : 'bg-fg/10'}`}
                    style={{
                      height: `${Math.max(2, Math.round((amount / peak) * 100))}%`,
                      animationDelay: `${index * 45}ms`,
                    }}
                  />
                </div>
                {/* Sur téléphone, un mois sur trois : douze libellés dans
                    trois cents pixels ne laissaient que « no… dé… ja… ». */}
                <span
                  className={`w-full whitespace-nowrap text-center text-[11px] text-fg/60 ${
                    index % 3 === 2 ? '' : 'max-sm:invisible'
                  } sm:truncate`}
                >
                  {point.month}
                </span>
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
          <div className="mt-5 flex flex-wrap gap-2 border-t border-fg/10 pt-4 text-sm">
            {revenue.pendingCount > 0 && (
              <Link
                href="/admin/abonnements"
                className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-state-warn hover:bg-amber-500/25"
              >
                {revenue.pendingCount} paiement{revenue.pendingCount > 1 ? 's' : ''} à valider
              </Link>
            )}
            {revenue.overdueCount > 0 && (
              <Link
                href="/admin/abonnements?statut=ACTIVE"
                className="rounded-lg bg-red-500/15 px-3 py-1.5 text-state-bad hover:bg-red-500/25"
              >
                {revenue.overdueCount} abonnement{revenue.overdueCount > 1 ? 's' : ''} actif
                {revenue.overdueCount > 1 ? 's' : ''} dont la période est dépassée
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Chaque produit dans son panneau, à sa couleur : braise pour
          Restaurant, or pour Boutique (voir `DomainPanel`). */}
      <DomainPanel
        domain="resto"
        title="MagyaPro Restaurant"
        description="État de la plateforme, tous restaurants confondus."
        icon={STAT_ICONS.restaurants}
      >

        <section
          aria-label="Indicateurs de la plateforme"
          className="stagger mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          <AdminStat domain="resto" label="Restaurants" value={metrics.restaurants} icon={STAT_ICONS.restaurants} />
          <AdminStat
            domain="resto"
            label="Actifs"
            value={metrics.activeRestaurants}
            icon={STAT_ICONS.active}
            hint={`${metrics.suspendedRestaurants} suspendu${metrics.suspendedRestaurants > 1 ? 's' : ''}`}
            // Ambre seulement s'il y a vraiment quelque chose à regarder.
            tone={metrics.suspendedRestaurants > 0 ? 'warning' : undefined}
          />
          <AdminStat domain="users" label="Utilisateurs" value={metrics.users} icon={STAT_ICONS.users} />
          <AdminStat
            domain="resto"
            label="Nouveaux (30 j)"
            value={metrics.newRestaurants}
            icon={STAT_ICONS.new}
            hint="Restaurants créés"
          />
          <AdminStat domain="resto" label="Commandes" value={metrics.orders} icon={STAT_ICONS.orders} />
          <AdminStat
            domain="resto"
            label="Volume traité"
            value={volumeValue(metrics.grossVolumeByCurrency)}
            icon={STAT_ICONS.volume}
            hint={volumeHint(metrics.grossVolumeByCurrency, 'Toutes commandes, hors annulées')}
          />
          <AdminStat
            domain="abo"
            label="Abonnements actifs"
            icon={STAT_ICONS.active_subs}
            value={
              (metrics.subscriptionsByStatus.ACTIVE ?? 0) +
                (metrics.subscriptionsByStatus.TRIALING ?? 0)
            }
          />
          <AdminStat
            domain="abo"
            label="Abonnements expirés"
            icon={STAT_ICONS.expired_subs}
            value={expiredRestaurantSubs}
            tone={expiredRestaurantSubs > 0 ? 'danger' : undefined}
          />
        </section>

        <p className="mt-3 text-xs text-fg/60">
          Le volume traité correspond au montant des commandes passées chez les
          restaurants ; il ne s&apos;agit pas du revenu de MagyaPro, qui provient des
          abonnements.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <section aria-labelledby="derniers-restaurants">
            <div className="flex items-center justify-between">
              <DomainHeading id="derniers-restaurants" domain="resto">
                Derniers restaurants
              </DomainHeading>
              <Link
                href="/admin/restaurants"
                className="text-sm text-fg/60 underline underline-offset-4 hover:text-fg"
              >
                Tout voir
              </Link>
            </div>

            <RecentAccounts
              domain="resto"
              hrefBase="/admin/restaurants"
              activityLabel={['commande', 'commandes']}
              emptyLabel="Aucun restaurant pour le moment."
              accounts={recentRestaurants.map(({ _count, ...restaurant }) => ({
                ...restaurant,
                activity: _count.orders,
              }))}
            />
          </section>

          <section aria-labelledby="abonnements">
            <DomainHeading id="abonnements" domain="abo">
              Répartition des abonnements
            </DomainHeading>
            <SubscriptionBreakdown counts={metrics.subscriptionsByStatus} />
          </section>
        </div>
      </DomainPanel>

      <DomainPanel
        domain="boutique"
        title="MagyaPro Boutique"
        description="État de la plateforme, toutes boutiques confondues."
        icon={STAT_ICONS.orders}
      >

        <section
          aria-label="Indicateurs Boutique de la plateforme"
          className="stagger mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          <AdminStat domain="boutique" label="Boutiques" value={storeMetrics.stores} icon={STAT_ICONS.restaurants} />
          <AdminStat
            domain="boutique"
            label="Actives"
            value={storeMetrics.activeStores}
            icon={STAT_ICONS.active}
            hint={`${storeMetrics.suspendedStores} suspendue${storeMetrics.suspendedStores > 1 ? 's' : ''}`}
            tone={storeMetrics.suspendedStores > 0 ? 'warning' : undefined}
          />
          <AdminStat
            domain="boutique"
            label="Nouvelles (30 j)"
            value={storeMetrics.newStores}
            icon={STAT_ICONS.new}
            hint="Boutiques créées"
          />
          <AdminStat domain="boutique" label="Ventes" value={storeMetrics.sales} icon={STAT_ICONS.orders} />
          <AdminStat
            domain="boutique"
            label="Volume traité"
            value={volumeValue(storeMetrics.grossVolumeByCurrency)}
            icon={STAT_ICONS.volume}
            hint={volumeHint(storeMetrics.grossVolumeByCurrency, 'Toutes ventes, hors annulées')}
          />
          <AdminStat
            domain="abo"
            label="Abonnements actifs"
            icon={STAT_ICONS.active_subs}
            value={
              (storeMetrics.subscriptionsByStatus.ACTIVE ?? 0) +
                (storeMetrics.subscriptionsByStatus.TRIALING ?? 0)
            }
          />
          <AdminStat
            domain="abo"
            label="Abonnements expirés"
            icon={STAT_ICONS.expired_subs}
            value={expiredStoreSubs}
            tone={expiredStoreSubs > 0 ? 'danger' : undefined}
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <section aria-labelledby="dernieres-boutiques">
            <div className="flex items-center justify-between">
              <DomainHeading id="dernieres-boutiques" domain="boutique">
                Dernières boutiques
              </DomainHeading>
              <Link
                href="/admin/boutiques"
                className="text-sm text-fg/60 underline underline-offset-4 hover:text-fg"
              >
                Tout voir
              </Link>
            </div>

            <RecentAccounts
              domain="boutique"
              hrefBase="/admin/boutiques"
              activityLabel={['vente', 'ventes']}
              emptyLabel="Aucune boutique pour le moment."
              accounts={recentStores.map(({ _count, ...store }) => ({ ...store, activity: _count.sales }))}
            />
          </section>

          <section aria-labelledby="abonnements-boutique">
            <DomainHeading id="abonnements-boutique" domain="abo">
              Répartition des abonnements Boutique
            </DomainHeading>
            <SubscriptionBreakdown counts={storeMetrics.subscriptionsByStatus} />
          </section>
        </div>
      </DomainPanel>

      {/* Le journal couvre les deux produits : il vit désormais à part,
          sur toute la largeur, au lieu d'être imbriqué dans la colonne
          des abonnements Restaurant où rien ne le rattachait. */}
      <section aria-label="Activité récente" className="mt-10 border-t border-fg/10 pt-6">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Activité récente</h2>
            <Link
              href="/admin/journal"
              className="text-sm text-fg/60 underline underline-offset-4 hover:text-fg"
            >
              Journal complet
            </Link>
          </div>
          <ul className="mt-3 space-y-2 rounded-2xl border border-fg/10 p-4 text-sm">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-fg/85">{auditActionLabel(log.action)}</span>
                  {log.actorEmail && (
                    <span className="block truncate text-xs text-fg/60">{log.actorEmail}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-fg/60">
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

/*
 * Domaine d'une carte — la couleur de son icône (voir `admin/domain.tsx`).
 * Elle dit de quoi parle le chiffre, jamais s'il est bon ou mauvais : c'est
 * le rôle du trait d'alerte ci-dessus.
 */
type StatDomain = Exclude<AdminDomain, 'comm'>;

function AdminStat({
  label,
  value,
  hint,
  icon,
  tone,
  domain,
}: {
  label: string;
  /** Un nombre est compté jusqu'à sa valeur ; un montant formaté est affiché tel quel. */
  value: number | string;
  hint?: string;
  icon?: React.ReactElement;
  /**
   * À ne renseigner que lorsque la VALEUR elle-même est un signal — trois
   * abonnements expirés, deux boutiques suspendues. Un compteur ordinaire
   * n'a pas de couleur.
   */
  tone?: 'success' | 'warning' | 'danger';
  domain: StatDomain;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-fg/10 bg-fg/[0.03] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-fg/20 hover:bg-fg/[0.05] sm:p-4">
      {tone ? (
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${STAT_ACCENT[tone]}`} />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] uppercase tracking-wide text-fg/60 sm:text-xs">{label}</p>
        {icon && (
          // Masquée sur téléphone : en deux colonnes, l'icône prenait la
          // place de l'intitulé, coupé en plein mot.
          <span
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${DOMAIN_CHIP[domain]}`}
          >
            {icon}
          </span>
        )}
      </div>
      {/* Chiffre dans l'encre pleine du thème : la couleur est sur l'icône,
          jamais sur le nombre, qui doit rester lisible d'abord. */}
      <p className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums text-fg sm:text-2xl">
        {typeof value === 'number' ? <CountUp value={value} /> : value}
      </p>
      {hint && <p className="mt-1 text-xs text-fg/60">{hint}</p>}
    </div>
  );
}


/**
 * Couleur de la jauge d'un statut d'abonnement : celle de son état — même
 * table que les pastilles (`SUBSCRIPTION_STATUS_TONES`). L'essai est violet,
 * couleur des abonnements : ce n'est ni un succès ni un problème, seulement un
 * abonnement qui n'est pas encore payant.
 */
const TONE_BAR: Record<StateTone, string> = {
  success: 'bg-emerald-500/80',
  warning: 'bg-amber-500/80',
  danger: 'bg-red-500/80',
  info: 'bg-domain-abo/80',
  brand: 'bg-fg/50',
  neutral: 'bg-fg/30',
};

/** Répartition des abonnements par statut, chaque ligne avec sa part du total. */
function SubscriptionBreakdown({ counts }: { counts: Partial<Record<string, number>> }) {
  const total = Math.max(
    1,
    SUBSCRIPTION_STATUSES.reduce((sum, key) => sum + (counts[key] ?? 0), 0),
  );
  return (
    <ul className="stagger mt-3 space-y-3 rounded-2xl border border-fg/10 p-4">
      {SUBSCRIPTION_STATUSES.map((key) => {
        const count = counts[key] ?? 0;
        return (
          <li key={key} className="text-sm">
            <div className="flex justify-between">
              <span className="text-fg/65">{SUBSCRIPTION_STATUS_LABELS[key]}</span>
              <span className="font-medium tabular-nums">{count}</span>
            </div>
            <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/[0.07]">
              <div
                className={`h-full origin-left animate-grow-x rounded-full ${TONE_BAR[SUBSCRIPTION_STATUS_TONES[key]]}`}
                style={{ width: `${count > 0 ? Math.max(3, (count / total) * 100) : 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
