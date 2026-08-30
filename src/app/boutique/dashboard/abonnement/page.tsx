import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatMoney } from '@/lib/money';
import { StoreSubscriptionPaymentFlow } from '@/components/boutique/subscription-payment-flow';
import { PlanCountdown } from '@/components/dashboard/plan-countdown';
import { Badge, Card, PageHeader } from '@/components/ui';
import { getActivePromo, getPlatformSettings } from '@/lib/platform-settings';
import { PromoBanner } from '@/components/marketing/promo-banner';
import { STORE_FEATURE_LABELS, type StoreFeature } from '@/lib/boutique/entitlements';
import {
  additionalStorePrice,
  getAdditionalStorePercent,
  getGroupPlanKey,
  getStoreBillingPosition,
} from '@/lib/boutique/store-pricing';

export const metadata: Metadata = { title: 'Abonnement' };
export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  TRIALING: "Période d'essai",
  ACTIVE: 'Actif',
  PAST_DUE: 'Paiement en retard',
  CANCELLED: 'Résilié',
  EXPIRED: 'Expiré',
};

/// Libellé d'une clé de fonctionnalité de plan Boutique — `STORE_FEATURE_LABELS`
/// pour les clés connues ; humanisée en repli pour une clé plus récente que
/// ce déploiement (les plans vivent en base, sans redéploiement).
function featureLabel(key: string): string {
  return STORE_FEATURE_LABELS[key as StoreFeature] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Abonnement Boutique — version allégée de l'équivalent Restaurant : pas de
 * barres d'utilisation ni d'options par fonctionnalité, Boutique n'ayant pas
 * (encore) de système de limites/entitlements par plan.
 */
export default async function StoreSubscriptionPage() {
  const context = await requireStore('subscription:view');

  const [
    subscription,
    plans,
    platformSettings,
    pendingPayment,
    promo,
    paidPayments,
    position,
    surchargePercent,
    lockedPlanKey,
  ] = await Promise.all([
      prisma.storeSubscription.findUnique({
        where: { storeId: context.store.id },
        include: { plan: true },
      }),
      prisma.plan.findMany({
        where: { isActive: true, product: 'STORE' },
        orderBy: { position: 'asc' },
      }),
      getPlatformSettings(),
      prisma.storeSubscriptionPayment.findFirst({
        where: { storeId: context.store.id, status: 'PENDING' },
        include: { plan: { select: { name: true } } },
      }),
      getActivePromo(),
      prisma.storeSubscriptionPayment.findMany({
        where: { storeId: context.store.id, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        take: 12,
        include: { plan: { select: { name: true } } },
      }),
      getStoreBillingPosition(context.store.id),
      getAdditionalStorePercent(),
      getGroupPlanKey(context.store.id),
    ]);
  const alreadyPaid = paidPayments.length > 0;

  // Montant réellement dû par cette boutique pour chaque plan. Calculé ici et
  // pas dans le navigateur : un prix ne se recalcule pas côté client, et c'est
  // la même règle que celle appliquée à la création du paiement.
  const amountFor = (price: number) =>
    position.isAdditional ? additionalStorePrice(price, surchargePercent) : price;

  // Le verrouillage sur le plan de la boutique principale ne vaut que si ce
  // plan figure vraiment parmi ceux proposés. Sinon (plan désactivé depuis, ou
  // rattaché à un autre produit), toutes les cartes seraient verrouillées et
  // la boutique n'aurait plus aucun moyen de payer : un cul-de-sac où l'on
  // réclame un règlement sans offrir de bouton pour le faire. Dans ce cas, on
  // rend le choix libre.
  const effectiveLockedPlanKey =
    lockedPlanKey && plans.some((plan) => plan.key === lockedPlanKey) ? lockedPlanKey : null;

  const availableProviders: Array<'wave_manual' | 'orange_money_manual'> = [
    ...(platformSettings?.waveNumber ? (['wave_manual'] as const) : []),
    ...(platformSettings?.orangeMoneyNumber ? (['orange_money_manual'] as const) : []),
  ];

  const receivingNumberFor = (provider: string) =>
    provider === 'wave_manual'
      ? (platformSettings?.waveNumber ?? '')
      : (platformSettings?.orangeMoneyNumber ?? '');

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
          currentPlanKey={subscription?.plan.key ?? null}
          availableProviders={availableProviders}
          pendingPayment={
            pendingPayment
              ? {
                  id: pendingPayment.id,
                  planName: pendingPayment.plan.name,
                  amountLabel: formatMoney(pendingPayment.amount, pendingPayment.currency),
                  provider: pendingPayment.provider as 'wave_manual' | 'orange_money_manual',
                  receivingNumber: receivingNumberFor(pendingPayment.provider),
                  proofImageUrl: pendingPayment.proofImageUrl,
                }
              : null
          }
          billing={{
            isAdditional: position.isAdditional,
            percent: position.isAdditional ? surchargePercent : null,
            lockedPlanKey: effectiveLockedPlanKey,
          }}
          plans={plans.map((plan) => ({
            key: plan.key,
            name: plan.name,
            description: plan.description,
            priceLabel: formatMoney(plan.price, plan.currency),
            amountLabel: formatMoney(amountFor(plan.price), plan.currency),
            price: plan.price,
            interval: plan.interval,
            trialDays: plan.trialDays,
            features: plan.features.map(featureLabel),
          }))}
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
