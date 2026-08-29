import Link from 'next/link';
import type { Metadata } from 'next';
import type { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { StoreSubscriptionPaymentReview } from '@/components/admin/store-subscription-payment-review';
import { getStoreBillingPosition } from '@/lib/boutique/store-pricing';

export const metadata: Metadata = { title: 'Abonnements Boutique' };
export const dynamic = 'force-dynamic';

const STATUSES: Array<{ key: SubscriptionStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  { key: 'TRIALING', label: 'En essai' },
  { key: 'ACTIVE', label: 'Actifs' },
  { key: 'PAST_DUE', label: 'En retard' },
  { key: 'CANCELLED', label: 'Résiliés' },
  { key: 'EXPIRED', label: 'Expirés' },
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
  searchParams: Promise<{ statut?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const status = STATUSES.some((entry) => entry.key === params.statut)
    ? (params.statut as SubscriptionStatus | 'ALL')
    : 'ALL';

  const [subscriptions, pendingPayments] = await Promise.all([
    prisma.storeSubscription.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { currentPeriodEnd: 'asc' },
      include: {
        plan: true,
        store: { select: { id: true, name: true, slug: true, status: true } },
      },
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
  const positions = new Map(
    await Promise.all(
      pendingPayments.map(
        async (payment) =>
          [payment.id, await getStoreBillingPosition(payment.store.id)] as const,
      ),
    ),
  );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Abonnements Boutique</h1>
      <p className="mt-1 text-sm text-white/60">
        {subscriptions.length} abonnement{subscriptions.length > 1 ? 's' : ''} pour ce filtre.
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
                  positions.get(payment.id)?.isAdditional
                    ? `Boutique supplémentaire (n° ${positions.get(payment.id)!.rank} du compte) — montant majoré, inférieur au tarif ${payment.plan.name} de ${formatMoney(payment.plan.price, payment.plan.currency)}`
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Filtrer par statut" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((entry) => (
          <Link
            key={entry.key}
            href={`/admin/boutique-abonnements?statut=${entry.key}`}
            aria-current={status === entry.key ? 'true' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
              status === entry.key
                ? 'bg-white text-ink'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {subscriptions.length === 0 ? (
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
              {subscriptions.map((subscription) => {
                const expired = subscription.currentPeriodEnd < new Date();

                return (
                  <tr key={subscription.id} className="border-b border-white/10">
                    <td data-label="Boutique" className="py-3 pr-3">
                      <Link
                        href={`/admin/boutiques/${subscription.store.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {subscription.store.name}
                      </Link>
                      <span className="block text-xs text-white/40">
                        {subscription.store.slug}
                      </span>
                    </td>
                    <td data-label="Plan" className="py-3 pr-3">
                      {subscription.plan.name}
                      <span className="block text-xs text-white/40">
                        {formatMoney(subscription.plan.price, subscription.plan.currency)} /{' '}
                        {subscription.plan.interval === 'MONTH' ? 'mois' : 'an'}
                      </span>
                    </td>
                    <td data-label="Statut" className="py-3 pr-3">
                      <span className="text-white/70">{subscription.status}</span>
                    </td>
                    <td data-label="Fin de période" className="py-3">
                      <span className={expired ? 'text-red-300' : 'text-white/70'}>
                        {subscription.currentPeriodEnd.toLocaleDateString('fr-FR')}
                        {expired && ' · dépassée'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
