import Link from 'next/link';
import type { Metadata } from 'next';
import type { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { StoreSubscriptionPaymentReview } from '@/components/admin/store-subscription-payment-review';
import { getStoreBillingPositions } from '@/lib/boutique/store-pricing';
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  subscriptionStatusLabel,
  subscriptionStatusTone,
} from '@/lib/subscription-labels';
import { AdminStateBadge } from '@/components/admin/state-badge';
import {
  RENEWAL_SOON_DAYS,
  SUBSCRIPTIONS_PAGE_SIZE,
  daysUntil,
  deadlineLabel,
  isDeadlineFilter,
  listStoreSubscriptions,
} from '@/lib/admin/subscriptions-list';
import { RenewalFilters } from '@/components/admin/renewal-filters';

export const metadata: Metadata = { title: 'Abonnements Boutique' };
export const dynamic = 'force-dynamic';

const STATUSES: Array<{ key: SubscriptionStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  ...SUBSCRIPTION_STATUSES.map((key) => ({ key, label: SUBSCRIPTION_STATUS_LABELS[key] })),
];

/**
 * Abonnements MagyaPro Boutique — équivalent de `/admin/abonnements`
 * (Restaurant), page distincte plutôt que fusionnée pour rester cohérent
 * avec `/admin/boutiques` posé en sibling de `/admin/restaurants`. Les
 * numéros de réception Wave/Orange Money sont réglés une seule fois pour
 * la plateforme (`PlatformSettings`, déjà visible sur `/admin/abonnements`)
 * — pas de duplication de ce panneau ici.
 */
export default async function AdminStoreSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string; echeance?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const status = STATUSES.some((entry) => entry.key === params.statut)
    ? (params.statut as SubscriptionStatus | 'ALL')
    : 'ALL';
  const search = params.q?.trim() || undefined;
  const deadline =
    params.echeance && isDeadlineFilter(params.echeance) ? params.echeance : undefined;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const [list, pendingPayments] = await Promise.all([
    listStoreSubscriptions({
      status: status === 'ALL' ? undefined : status,
      search,
      deadline,
      page,
    }),
    prisma.storeSubscriptionPayment.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        plan: { select: { name: true, price: true, currency: true } },
        store: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Rang de facturation de chaque boutique dont un paiement attend validation.
  // Un montant inférieur au tarif du plan doit s'expliquer à l'écran, sinon on
  // hésite à valider ou on valide à tort.
  //
  // Chargé en une fois pour toutes les boutiques concernées : une version
  // précédente interrogeait la base par paiement affiché, soit trois requêtes
  // par ligne du tableau.
  const positions = await getStoreBillingPositions(
    pendingPayments.map((payment) => payment.store.id),
  );

  // Date figée côté serveur : le retard d'une échéance ne doit pas dépendre de
  // l'horloge du navigateur qui consulte la page.
  const now = new Date();

  const hrefWith = (overrides: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const values = { statut: status === 'ALL' ? undefined : status, q: search, echeance: deadline, ...overrides };
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
    }
    const suffix = query.toString();
    return suffix ? `/admin/boutique-abonnements?${suffix}` : '/admin/boutique-abonnements';
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Abonnements Boutique</h1>
      <p className="mt-1 text-sm text-white/60">
        {list.total} abonnement{list.total > 1 ? 's' : ''} pour ce filtre
        {list.pageCount > 1 ? ` · page ${list.page} sur ${list.pageCount}` : ''}.
      </p>

      {pendingPayments.length > 0 && (
        <section aria-label="Paiements en attente" className="mt-6">
          <h2 className="text-sm font-medium text-white/80">
            {pendingPayments.length} paiement{pendingPayments.length > 1 ? 's' : ''} en attente de validation
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {pendingPayments.map((payment) => (
              <StoreSubscriptionPaymentReview
                key={payment.id}
                paymentId={payment.id}
                storeName={payment.store.name}
                planName={payment.plan.name}
                amountLabel={formatMoney(payment.amount, payment.currency)}
                provider={payment.provider}
                country={payment.country}
                proofImageUrl={payment.proofImageUrl}
                submittedLabel={
                  payment.proofSubmittedAt
                    ? payment.proofSubmittedAt.toLocaleDateString('fr-FR')
                    : 'preuve non encore déposée'
                }
                billingNote={
                  positions.get(payment.store.id)?.isAdditional
                    ? `Boutique supplémentaire (n° ${positions.get(payment.store.id)!.rank} du compte), montant majoré, inférieur au tarif ${payment.plan.name} de ${formatMoney(payment.plan.price, payment.plan.currency)}`
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}

      <RenewalFilters
        basePath="/admin/boutique-abonnements"
        status={status}
        search={search}
        deadline={deadline}
        counts={list.counts}
        tenantLabel="une boutique"
      />

      {list.rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/20 p-10 text-center text-sm text-white/60">
          Aucun abonnement pour ce filtre.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="table-stack w-full border-collapse text-sm">
            <caption className="sr-only">Abonnements des boutiques</caption>
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th scope="col" className="py-2 pr-3 font-medium">Boutique</th>
                <th scope="col" className="py-2 pr-3 font-medium">Plan</th>
                <th scope="col" className="py-2 pr-3 font-medium">Statut</th>
                <th scope="col" className="py-2 font-medium">Fin de période</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((subscription) => {
                const days = daysUntil(subscription.currentPeriodEnd, now);

                return (
                  <tr key={subscription.id} className="border-b border-white/10">
                    <td data-label="Boutique" className="py-3 pr-3">
                      <Link
                        href={`/admin/boutiques/${subscription.tenant.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {subscription.tenant.name}
                      </Link>
                      <span className="block text-xs text-white/40">
                        {subscription.tenant.slug}
                      </span>
                    </td>
                    <td data-label="Plan" className="py-3 pr-3">
                      {subscription.plan.name}
                      <span className="block text-xs text-white/40">
                        {formatMoney(subscription.plan.price, subscription.plan.currency)} /{' '}
                        {subscription.plan.interval === 'MONTH' ? 'mois' : 'an'}
                      </span>
                      {/* Une boutique rattachée à un plan Restaurant est facturée
                          sur la mauvaise grille. Rien ne le signalait : les deux
                          produits ont des plans qui portent le même nom, et la
                          colonne n'affichait que ce nom. */}
                      {subscription.plan.product !== 'STORE' && (
                        <span className="mt-1 inline-block rounded-md bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">
                          Plan {subscription.plan.product.toLowerCase()}, pas un plan Boutique
                        </span>
                      )}
                    </td>
                    <td data-label="Statut" className="py-3 pr-3">
                      <AdminStateBadge
                        label={subscriptionStatusLabel(subscription.status)}
                        tone={subscriptionStatusTone(subscription.status)}
                      />
                    </td>
                    <td data-label="Fin de période" className="py-3">
                      <span
                        className={
                          days < 0 ? 'text-red-300' : days <= RENEWAL_SOON_DAYS ? 'text-amber-200' : 'text-white/70'
                        }
                      >
                        {subscription.currentPeriodEnd.toLocaleDateString('fr-FR')}
                        <span className="block text-xs opacity-80">{deadlineLabel(days)}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {list.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-white/60">
            Page {list.page} sur {list.pageCount} · {SUBSCRIPTIONS_PAGE_SIZE} par page
          </span>
          <div className="flex gap-2">
            {list.page > 1 && (
              <Link
                href={hrefWith({ page: String(list.page - 1) })}
                className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Précédent
              </Link>
            )}
            {list.page < list.pageCount && (
              <Link
                href={hrefWith({ page: String(list.page + 1) })}
                className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Suivant
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
