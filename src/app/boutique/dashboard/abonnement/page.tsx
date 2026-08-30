import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { StoreSubscriptionPaymentFlow } from '@/components/boutique/subscription-payment-flow';
import { PlanCountdown } from '@/components/dashboard/plan-countdown';
import { Badge, Card, PageHeader } from '@/components/ui';
import { getActivePromo } from '@/lib/platform-settings';
import { PromoBanner } from '@/components/marketing/promo-banner';
import { loadStoreSubscriptionScreen } from '@/lib/boutique/subscription-screen';

export const metadata: Metadata = { title: 'Abonnement' };
export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  TRIALING: "Période d'essai",
  ACTIVE: 'Actif',
  PAST_DUE: 'Paiement en retard',
  CANCELLED: 'Résilié',
  EXPIRED: 'Expiré',
};

/**
 * Abonnement Boutique — version allégée de l'équivalent Restaurant : pas de
 * barres d'utilisation ni d'options par fonctionnalité, Boutique n'ayant pas
 * (encore) de système de limites/entitlements par plan.
 */
export default async function StoreSubscriptionPage() {
  const context = await requireStore('subscription:view');

  const [screen, promo, paidPayments] = await Promise.all([
    loadStoreSubscriptionScreen(context.store.id),
    getActivePromo(),
    prisma.storeSubscriptionPayment.findMany({
      where: { storeId: context.store.id, status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' },
      take: 12,
      include: { plan: { select: { name: true } } },
    }),
  ]);

  const subscription = screen.subscription;
  const alreadyPaid = paidPayments.length > 0;

  return (
    <>
      <PageHeader
        title="Abonnement"
        description="Le plan de votre boutique et son état de renouvellement."
      />

      {subscription && subscription.plan.product !== 'STORE' && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-state-bad/40 bg-state-bad-soft px-4 py-3 text-sm text-state-bad"
        >
          Le plan rattaché à cette boutique (« {subscription.plan.name} ») appartient au produit
          Restaurant, pas à Boutique. Les montants qui en découlent ne sont pas ceux de la grille
          Boutique. Choisissez ci-dessous le plan Boutique correspondant, ou signalez-le à
          l’assistance.
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Plan actuel</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
              {subscription?.plan.name ?? 'Aucun plan'}
              {subscription && (
                <Badge
                  tone={
                    subscription.status === 'ACTIVE'
                      ? 'success'
                      : subscription.status === 'TRIALING'
                        ? 'info'
                        : 'danger'
                  }
                >
                  {STATUS_LABELS[subscription.status] ?? subscription.status}
                </Badge>
              )}
            </p>
          </div>

          {subscription?.status === 'PAST_DUE' && subscription.graceEndsAt ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Délai de grâce avant repli automatique
              </p>
              <p className="mt-1 text-sm">
                {subscription.graceEndsAt.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <PlanCountdown currentPeriodEnd={subscription.graceEndsAt.toISOString()} />
            </div>
          ) : (
            subscription?.currentPeriodEnd && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-ink-faint">
                  {subscription.status === 'TRIALING' ? "Fin d'essai" : 'Période en cours'}
                </p>
                <p className="mt-1 text-sm">
                  {subscription.currentPeriodEnd.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <PlanCountdown currentPeriodEnd={subscription.currentPeriodEnd.toISOString()} />
              </div>
            )
          )}
        </div>
      </Card>

      {promo && !alreadyPaid && (
        <div className="mt-6">
          <PromoBanner
            discountPercent={promo.discountPercent}
            endsAt={promo.endsAt}
            label={promo.label}
          />
        </div>
      )}

      <div className="mt-6">
        <StoreSubscriptionPaymentFlow
          canManage={context.permissions.has('subscription:manage')}
          currentPlanKey={screen.currentPlanKey}
          availableProviders={screen.availableProviders}
          pendingPayment={screen.pendingPayment}
          billing={screen.billing}
          plans={screen.plans}
        />
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Les plans payants demandent un envoi Wave/Orange Money au numéro de la
        plateforme puis une preuve de paiement : le nouveau plan s&apos;active
        une fois la réception validée par Magyapro. Les plans gratuits
        s&apos;appliquent immédiatement.
      </p>

      {paidPayments.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="text-sm font-medium">Historique des paiements</h2>
          <ul className="mt-3 divide-y divide-surface-border">
            {paidPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <div>
                  <p>{payment.plan.name}</p>
                  <p className="text-xs text-ink-faint">
                    {(payment.reviewedAt ?? payment.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    · {formatMoney(payment.amount, payment.currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
