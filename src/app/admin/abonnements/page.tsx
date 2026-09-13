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
  listRestaurantSubscriptions,
} from '@/lib/admin/subscriptions-list';
import { RenewalFilters } from '@/components/admin/renewal-filters';

export const metadata: Metadata = { title: 'Abonnements' };
export const dynamic = 'force-dynamic';

const STATUSES: Array<{ key: SubscriptionStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  ...SUBSCRIPTION_STATUSES.map((key) => ({ key, label: SUBSCRIPTION_STATUS_LABELS[key] })),
];

export default async function AdminSubscriptionsPage({
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

  const [list, payments, platformSettings, pendingPayments] = await Promise.all([
    listRestaurantSubscriptions({
      status: status === 'ALL' ? undefined : status,
      search,
      deadline,
      page,
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
    // Même filtre que le compteur de la vue d'ensemble : une demande de
    // démonstration n'a pas à être soumise à validation, et la liste doit
    // porter exactement ce que le compteur annonce.
    prisma.subscriptionPayment.findMany({
      where: { status: 'PENDING', restaurant: { isDemo: false } },
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
    return suffix ? `/admin/abonnements?${suffix}` : '/admin/abonnements';
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Abonnements</h1>
      <p className="mt-1 text-sm text-white/60">
        {list.total} abonnement{list.total > 1 ? 's' : ''} pour ce filtre
        {list.pageCount > 1 ? ` · page ${list.page} sur ${list.pageCount}` : ''}.
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

      <RenewalFilters
        basePath="/admin/abonnements"
        status={status}
        search={search}
        deadline={deadline}
        counts={list.counts}
        tenantLabel="un restaurant"
      />

      {list.rows.length === 0 ? (
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
              {list.rows.map((subscription) => {
                const days = daysUntil(subscription.currentPeriodEnd, now);

                return (
                  <tr key={subscription.id} className="border-b border-white/10">
                    <td data-label="Restaurant" className="py-3 pr-3">
                      <Link
                        href={`/admin/restaurants/${subscription.tenant.id}`}
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
                    </td>
                    <td data-label="Statut" className="py-3 pr-3">
                      {/* Le code brut de la base était affiché tel quel :
                          « PAST_DUE » sur la ligne d'un client. */}
                      <AdminStateBadge
                        label={subscriptionStatusLabel(subscription.status)}
                        tone={subscriptionStatusTone(subscription.status)}
                      />
                    </td>
                    <td data-label="Fin de période" className="py-3 pr-3">
                      {/* La date seule obligeait à compter les jours de tête
                          pour savoir s'il fallait relancer. */}
                      <span
                        className={
                          days < 0 ? 'text-red-300' : days <= RENEWAL_SOON_DAYS ? 'text-amber-200' : 'text-white/70'
                        }
                      >
                        {subscription.currentPeriodEnd.toLocaleDateString('fr-FR')}
                        <span className="block text-xs opacity-80">{deadlineLabel(days)}</span>
                      </span>
                    </td>
                    <td data-label="Encaissé" className="py-3 text-right">
                      {formatMoney(
                        paidByRestaurant.get(subscription.tenant.id) ?? 0,
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

      <p className="mt-4 text-xs text-white/40">
        La colonne « Encaissé » agrège les paiements de commandes marqués payés
        chez le restaurant, pas le règlement de l&apos;abonnement (voir les
        paiements en attente ci-dessus).
      </p>
    </>
  );
}
