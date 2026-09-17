import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { StatusPill } from '@/components/admin/state-badge';
import { RestaurantAdminActions } from '@/components/admin/restaurant-actions';
import { SubscriptionManager } from '@/components/admin/subscription-manager';
import { DemoRestaurantEditor } from '@/components/admin/demo-restaurant-editor';
import { SubscriptionPanel } from '@/components/admin/subscription-panel';
import { listRestaurantPayments } from '@/lib/platform-revenue';
import { Metric } from '@/components/admin/charts';
import { ROLE_LABELS } from '@/lib/rbac';

export const metadata: Metadata = { title: 'Fiche restaurant' };
export const dynamic = 'force-dynamic';

/** Libellés des domaines — affichés ici seulement, d'où la table locale. */
const DOMAIN_TYPE_LABELS: Record<string, string> = {
  SUBDOMAIN: 'Sous-domaine',
  CUSTOM: 'Domaine propre',
};

const DOMAIN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  VERIFIED: 'Vérifié',
  FAILED: 'Échec',
};

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      members: {
        include: { user: { select: { name: true, email: true, status: true } } },
        orderBy: { createdAt: 'asc' },
      },
      domains: true,
      _count: { select: { orders: true, products: true, customers: true } },
    },
  });

  if (!restaurant) notFound();

  const [revenue, supportHistory, plans, payments] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId: restaurant.id, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.supportAccess.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: { admin: { select: { email: true } } },
    }),
    prisma.plan.findMany({
      where: { isActive: true, product: 'RESTAURANT' },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    listRestaurantPayments(id),
  ]);

  // Date figée côté serveur : le retard d'une échéance ne doit pas dépendre de
  // l'horloge du navigateur qui consulte la fiche.
  const now = new Date();

  // Utile seulement pour l'édition directe des restaurants de démonstration.
  const templates = restaurant.isDemo
    ? await prisma.template.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: { key: true, name: true },
      })
    : [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/restaurants"
            className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
          >
            ← Restaurants
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {restaurant.name}
            <StatusPill status={restaurant.status} />
          </h1>
          <p className="mt-1 font-mono text-sm text-white/50">{restaurant.slug}</p>
        </div>

        <Link
          href={`/r/${restaurant.slug}`}
          target="_blank"
          rel="noopener"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
        >
          Voir le site public
        </Link>
      </div>

      <section
        aria-label="Chiffres clés"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric label="Commandes" value={String(restaurant._count.orders)} />
        <Metric
          label="Volume"
          value={formatMoney(revenue._sum.total ?? 0, restaurant.currency)}
        />
        <Metric label="Plats" value={String(restaurant._count.products)} />
        <Metric label="Clients" value={String(restaurant._count.customers)} />
      </section>

      {restaurant.isDemo && (
        <section aria-labelledby="demo-edit" className="mt-8">
          <h2 id="demo-edit" className="text-sm font-medium">
            Modifier cette vitrine de démonstration
          </h2>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <DemoRestaurantEditor
              restaurantId={restaurant.id}
              name={restaurant.name}
              description={restaurant.description}
              primaryColor={restaurant.primaryColor}
              secondaryColor={restaurant.secondaryColor}
              templateKey={restaurant.templateKey}
              templates={templates}
            />
          </div>
        </section>
      )}

      {/* `min-w-0` sur les deux colonnes : la largeur plancher d'un élément de
          grille est celle de son contenu, si bien qu'une colonne refusait de
          se comprimer et débordait de 40 px sur un écran de 320. Mesuré. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="actions" className="min-w-0">
          <h2 id="actions" className="text-sm font-medium">
            Actions d&apos;administration
          </h2>
          <div className="mt-3 rounded-2xl border border-white/10 p-4">
            <RestaurantAdminActions
              restaurant={{
                id: restaurant.id,
                name: restaurant.name,
                status: restaurant.status,
                ordersCount: restaurant._count.orders,
              }}
            />
          </div>
        </section>

        <section aria-labelledby="abonnement" className="min-w-0">
          <h2 id="abonnement" className="text-sm font-medium">
            Abonnement
          </h2>
          {restaurant.subscription ? (
            <div className="mt-3 space-y-3">
              <SubscriptionPanel
                plan={restaurant.subscription.plan}
                status={restaurant.subscription.status}
                currentPeriodEnd={restaurant.subscription.currentPeriodEnd}
                payments={payments}
                billingNote={
                  // Un restaurant rattaché à un plan Boutique est facturé sur
                  // la mauvaise grille. Les deux produits ont des plans
                  // homonymes, seul le produit les distingue.
                  restaurant.subscription.plan.product !== 'RESTAURANT'
                    ? `Plan ${restaurant.subscription.plan.product.toLowerCase()}, pas un plan Restaurant`
                    : null
                }
                now={now}
              />
              <div className="rounded-2xl border border-white/10 p-4">
                <SubscriptionManager
                  restaurantId={restaurant.id}
                  plans={plans}
                  subscription={{
                    planId: restaurant.subscription.planId,
                    status: restaurant.subscription.status,
                    currentPeriodEnd: restaurant.subscription.currentPeriodEnd.toISOString(),
                    trialEndsAt: restaurant.subscription.trialEndsAt?.toISOString() ?? null,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">
              Aucun abonnement rattaché.
            </p>
          )}

          <h2 className="mt-6 text-sm font-medium">Équipe</h2>
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {restaurant.members.map((member) => (
              <li key={member.id} className="flex justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{member.user.name}</span>
                  <span className="block truncate text-xs text-white/40">
                    {member.user.email}
                  </span>
                </span>
                {/* Le code brut du rôle était affiché — « STAFF » au lieu de
                    son libellé, alors que la table existe dans `rbac.ts`. */}
                <span className="shrink-0 text-xs text-white/50">
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </li>
            ))}
            {restaurant.members.length === 0 && (
              <li className="p-3.5 text-sm text-white/50">Aucun membre.</li>
            )}
          </ul>

          <h2 className="mt-6 text-sm font-medium">Domaines</h2>
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {restaurant.domains.map((domain) => (
              <li key={domain.id} className="flex justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0 truncate font-mono">{domain.hostname}</span>
                <span className="shrink-0 text-xs text-white/50">
                  {DOMAIN_TYPE_LABELS[domain.type] ?? domain.type} ·{' '}
                  {DOMAIN_STATUS_LABELS[domain.status] ?? domain.status}
                </span>
              </li>
            ))}
            {restaurant.domains.length === 0 && (
              // Une liste vide encadrée laissait croire à un chargement raté.
              <li className="p-3.5 text-sm text-white/50">Aucun domaine rattaché.</li>
            )}
          </ul>
        </section>
      </div>

      <section aria-labelledby="support" className="mt-8">
        <h2 id="support" className="text-sm font-medium">
          Historique des accès support
        </h2>
        {supportHistory.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">
            Aucun accès support n&apos;a été ouvert sur cet espace.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
            {supportHistory.map((access) => (
              <li key={access.id} className="p-3.5 text-sm">
                <p className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{access.admin.email}</span>
                  <span className="text-xs text-white/40">
                    {access.startedAt.toLocaleString('fr-FR')}
                    {access.endedAt
                      ? ` → ${access.endedAt.toLocaleTimeString('fr-FR')}`
                      : ' · en cours'}
                  </span>
                </p>
                <p className="mt-1 text-white/60">{access.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
