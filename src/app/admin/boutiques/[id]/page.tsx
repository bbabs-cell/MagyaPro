import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import { StatusPill } from '@/components/admin/state-badge';
import { BoutiqueAdminActions } from '@/components/admin/boutique-actions';
import { SECTOR_LABELS as BUSINESS_TYPE_LABELS } from '@/lib/boutique/unit-catalogue';
import { SubscriptionPanel } from '@/components/admin/subscription-panel';
import { listStorePayments } from '@/lib/platform-revenue';
import { getStoreBillingPosition } from '@/lib/boutique/store-pricing';
import { SALE_STATUS_LABELS } from '@/lib/boutique/labels';

export const metadata: Metadata = { title: 'Fiche boutique' };
export const dynamic = 'force-dynamic';

export default async function AdminBoutiqueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      members: {
        include: { user: { select: { name: true, email: true, status: true, lastLoginAt: true } } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { sales: true, products: true, customers: true } },
    },
  });
  if (!store) notFound();

  const [revenue, recentSales, payments, position] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId: store.id, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.sale.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, number: true, total: true, status: true, createdAt: true },
    }),
    listStorePayments(id),
    // Rang de facturation : une boutique supplémentaire est réglée à un tarif
    // majoré, inférieur au prix affiché du plan. Sans cette précision, un
    // montant plus faible que le plan ressemble à une erreur.
    getStoreBillingPosition(id),
  ]);

  // Date figée côté serveur : le retard d'une échéance ne doit pas dépendre de
  // l'horloge du navigateur qui consulte la fiche.
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/boutiques"
            className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
          >
            ← Boutiques
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {store.name}
            <StatusPill status={store.status} />
          </h1>
          <p className="mt-1 font-mono text-sm text-white/50">{store.slug}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Type</p>
          <p className="mt-1 text-lg font-semibold">
            {BUSINESS_TYPE_LABELS[store.businessType] ?? store.businessType}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Volume total</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoney(revenue._sum.total ?? 0, store.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Ventes</p>
          <p className="mt-1 text-lg font-semibold">{store._count.sales}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Produits</p>
          <p className="mt-1 text-lg font-semibold">{store._count.products}</p>
        </div>
      </div>

      {/* La fiche ne disait rien de l'abonnement : savoir si cette boutique
          payait demandait de retourner sur la liste des abonnements. */}
      <section aria-labelledby="abonnement" className="mt-8 lg:max-w-xl">
        <h2 id="abonnement" className="text-sm font-medium">
          Abonnement
        </h2>
        {store.subscription ? (
          <div className="mt-3">
            <SubscriptionPanel
              plan={store.subscription.plan}
              status={store.subscription.status}
              currentPeriodEnd={store.subscription.currentPeriodEnd}
              payments={payments}
              billingNote={
                store.subscription.plan.product !== 'STORE'
                  ? `Plan ${store.subscription.plan.product.toLowerCase()}, pas un plan Boutique`
                  : position.isAdditional
                    ? `Boutique n° ${position.rank} du compte : facturée au tarif majoré, donc inférieur au prix affiché du plan.`
                    : null
              }
              now={now}
            />
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-sm text-white/60">
            Aucun abonnement rattaché — la boutique ne peut pas être utilisée
            tant qu&apos;un plan n&apos;a pas été réglé.
          </p>
        )}
      </section>

      <section aria-labelledby="actions" className="mt-8">
        <h2 id="actions" className="text-sm font-medium">
          Actions d&apos;administration
        </h2>
        <div className="mt-3 rounded-2xl border border-white/10 p-4">
          <BoutiqueAdminActions
            store={{
              id: store.id,
              name: store.name,
              status: store.status,
              salesCount: store._count.sales,
            }}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium">Équipe</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {store.members.map((member) => (
              <li key={member.id} className="py-3">
                <p className="font-medium">
                  {member.user.name}{' '}
                  <span className="font-normal text-white/40">
                    · {STORE_ROLE_LABELS[member.role]}
                  </span>
                </p>
                <p className="text-sm text-white/50">{member.user.email}</p>
              </li>
            ))}
            {store.members.length === 0 && (
              <li className="py-3 text-sm text-white/50">Aucun membre.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">Ventes récentes</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">n°{sale.number}</p>
                  <p className="text-sm text-white/50">
                    {sale.createdAt.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {/* Le statut était chargé mais jamais affiché : une vente
                      annulée ou remboursée avait l'air d'une vente normale, et
                      son montant se lisait comme encaissé. */}
                  <span
                    className={
                      sale.status === 'COMPLETED'
                        ? 'font-medium'
                        : 'font-medium text-white/40 line-through'
                    }
                  >
                    {formatMoney(sale.total, store.currency)}
                  </span>
                  {sale.status !== 'COMPLETED' && (
                    <span className="block text-xs text-white/50">
                      {SALE_STATUS_LABELS[sale.status]}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {recentSales.length === 0 && (
              <li className="py-3 text-sm text-white/50">Aucune vente.</li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}
