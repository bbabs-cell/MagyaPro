import Link from 'next/link';
import type { Metadata } from 'next';
import type { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money';
import { getPlatformSettings } from '@/lib/platform-settings';
import { PlatformPaymentSettings } from '@/components/admin/platform-payment-settings';
import { DEFAULT_ADDITIONAL_STORE_PERCENT } from '@/lib/boutique/store-pricing';
import { PlatformSoundSettings } from '@/components/admin/platform-sound-settings';
import { SubscriptionPaymentReview } from '@/components/admin/subscription-payment-review';

export const metadata: Metadata = { title: 'Abonnements' };
export const dynamic = 'force-dynamic';

const STATUSES: Array<{ key: SubscriptionStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  { key: 'TRIALING', label: 'En essai' },
  { key: 'ACTIVE', label: 'Actifs' },
  { key: 'PAST_DUE', label: 'En retard' },
  { key: 'CANCELLED', label: 'Résiliés' },
  { key: 'EXPIRED', label: 'Expirés' },
];

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const status = STATUSES.some((entry) => entry.key === params.statut)
    ? (params.statut as SubscriptionStatus | 'ALL')
    : 'ALL';

  const [subscriptions, payments, platformSettings, pendingPayments] = await Promise.all([
    prisma.subscription.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { currentPeriodEnd: 'asc' },
      include: {
        plan: true,
        restaurant: { select: { id: true, name: true, slug: true, status: true } },
      },
    }),
    // Encaissements des restaurants — utile pour juger l'activité réelle
    // derrière un abonnement. Les restaurants de démonstration en sont
    // exclus : ce ne sont pas de vrais encaissements.
    prisma.payment.groupBy({
      by: ['restaurantId'],
      where: { status: 'PAID', restaurant: { isDemo: false } },
      _sum: { amount: true },
    }),
    getPlatformSettings(),
    prisma.subscriptionPayment.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        plan: { select: { name: true } },
        restaurant: { select: { name: true } },
      },
    }),
  ]);

  const paidByRestaurant = new Map(
    payments.map((row) => [row.restaurantId, row._sum.amount ?? 0]),
  );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Abonnements</h1>
      <p className="mt-1 text-sm text-white/60">
        {subscriptions.length} abonnement{subscriptions.length > 1 ? 's' : ''} pour ce filtre.
      </p>

      <section
        aria-label="Encaissement des abonnements"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <h2 className="text-sm font-medium">Numéros de réception (paiement manuel)</h2>
        <p className="mt-1 text-xs text-white/50">
          Les restaurateurs envoient le montant de leur abonnement à ces numéros, puis déposent une preuve à valider ci-dessous.
        </p>
        <div className="mt-3">
          <PlatformPaymentSettings
            waveNumber={platformSettings?.waveNumber ?? null}
            orangeMoneyNumber={platformSettings?.orangeMoneyNumber ?? null}
            promoDiscountPercent={platformSettings?.promoDiscountPercent ?? null}
            promoEndsAt={platformSettings?.promoEndsAt ?? null}
            promoLabel={platformSettings?.promoLabel ?? null}
            additionalStorePercent={
              platformSettings?.additionalStorePercent ?? DEFAULT_ADDITIONAL_STORE_PERCENT
            }
          />

          <PlatformSoundSettings soundUrl={platformSettings?.notificationSoundUrl ?? null} />
        </div>
      </section>

      {pendingPayments.length > 0 && (
        <section aria-label="Paiements en attente" className="mt-6">
          <h2 className="text-sm font-medium text-white/80">
            {pendingPayments.length} paiement{pendingPayments.length > 1 ? 's' : ''} en attente de validation
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {pendingPayments.map((payment) => (
              <SubscriptionPaymentReview
                key={payment.id}
                paymentId={payment.id}
                restaurantName={payment.restaurant.name}
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
              />
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Filtrer par statut" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((entry) => (
          <Link
            key={entry.key}
            href={`/admin/abonnements?statut=${entry.key}`}
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
            <caption className="sr-only">Abonnements des restaurants</caption>
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th scope="col" className="py-2 pr-3 font-medium">Restaurant</th>
                <th scope="col" className="py-2 pr-3 font-medium">Plan</th>
                <th scope="col" className="py-2 pr-3 font-medium">Statut</th>
                <th scope="col" className="py-2 pr-3 font-medium">Fin de période</th>
                <th scope="col" className="py-2 text-right font-medium">Encaissé</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => {
                const expired = subscription.currentPeriodEnd < new Date();

                return (
                  <tr key={subscription.id} className="border-b border-white/10">
                    <td data-label="Restaurant" className="py-3 pr-3">
                      <Link
                        href={`/admin/restaurants/${subscription.restaurant.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {subscription.restaurant.name}
                      </Link>
                      <span className="block text-xs text-white/40">
                        {subscription.restaurant.slug}
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
                    <td data-label="Fin de période" className="py-3 pr-3">
                      <span className={expired ? 'text-red-300' : 'text-white/70'}>
                        {subscription.currentPeriodEnd.toLocaleDateString('fr-FR')}
                        {expired && ' · dépassée'}
                      </span>
                    </td>
                    <td data-label="Encaissé" className="py-3 text-right">
                      {formatMoney(
                        paidByRestaurant.get(subscription.restaurantId) ?? 0,
                        subscription.plan.currency,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-white/40">
        La colonne « Encaissé » agrège les paiements de commandes marqués payés
        chez le restaurant, pas le règlement de l&apos;abonnement (voir les
        paiements en attente ci-dessus).
      </p>
    </>
  );
}
