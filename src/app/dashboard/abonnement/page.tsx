import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURE_LABELS, LIMIT_LABELS, type Feature, type PlanLimits } from '@/lib/entitlements';
import { formatMoney } from '@/lib/money';
import { SubscriptionPaymentFlow } from '@/components/dashboard/subscription-payment-flow';
import { loadSubscriptionScreen } from '@/lib/subscription-screen';
import { PlanCountdown } from '@/components/dashboard/plan-countdown';
import { Badge, Card, PageHeader } from '@/components/ui';
import { getActivePromo, getPlatformSettings } from '@/lib/platform-settings';
import { PromoBanner } from '@/components/marketing/promo-banner';
import { subscriptionStatusMerchantLabel } from '@/lib/subscription-labels';

export const metadata: Metadata = { title: 'Abonnement' };
export const dynamic = 'force-dynamic';

export default async function SubscriptionPage() {
  const context = await requireTenant('subscription:view');

  // Le chargeur est isolé du reste : mêler son type à ceux des requêtes
  // voisines dans un même `Promise.all` élargit le tuple en union et fait
  // perdre l'inférence sur les autres résultats.
  const screen = await loadSubscriptionScreen(context.restaurant.id);

  const [usage, platformSettings, promo, paidPayments] =
    await Promise.all([
      Promise.all([
        prisma.product.count({ where: { restaurantId: context.restaurant.id } }),
        prisma.category.count({ where: { restaurantId: context.restaurant.id } }),
        prisma.restaurantUser.count({ where: { restaurantId: context.restaurant.id } }),
      ]),
      getPlatformSettings(),
      getActivePromo(),
      prisma.subscriptionPayment.findMany({
        where: { restaurantId: context.restaurant.id, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        take: 12,
        include: { plan: { select: { name: true } } },
      }),
    ]);
  const alreadyPaid = paidPayments.length > 0;
  const { entitlements, pendingPayment } = screen;

  const availableProviders: Array<'wave_manual' | 'orange_money_manual'> = [
    ...(platformSettings?.waveNumber ? (['wave_manual'] as const) : []),
    ...(platformSettings?.orangeMoneyNumber ? (['orange_money_manual'] as const) : []),
  ];


  const [products, categories, users] = usage;
  const limits = entitlements.limits;

  const usageRows = (
    [
      ['maxProducts', products],
      ['maxCategories', categories],
      ['maxUsers', users],
    ] as Array<[keyof PlanLimits, number]>
  ).filter(([key]) => limits[key] !== undefined);

  return (
    <>
      <PageHeader
        title="Abonnement"
        description="Votre plan, vos limites et les options incluses."
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Plan actuel</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
              {entitlements.planName}
              <Badge
                tone={
                  entitlements.status === 'ACTIVE'
                    ? 'success'
                    : entitlements.status === 'TRIALING'
                      ? 'info'
                      : 'danger'
                }
              >
                {subscriptionStatusMerchantLabel(entitlements.status)}
              </Badge>
            </p>
          </div>

          {entitlements.status === 'PAST_DUE' && entitlements.graceEndsAt ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Délai de grâce avant repli automatique
              </p>
              <p className="mt-1 text-sm">
                {entitlements.graceEndsAt.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <PlanCountdown currentPeriodEnd={entitlements.graceEndsAt.toISOString()} />
            </div>
          ) : (
            entitlements.currentPeriodEnd && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-ink-faint">
                  {entitlements.status === 'TRIALING' ? "Fin d'essai" : 'Période en cours'}
                </p>
                <p className="mt-1 text-sm">
                  {entitlements.currentPeriodEnd.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <PlanCountdown currentPeriodEnd={entitlements.currentPeriodEnd.toISOString()} />
              </div>
            )
          )}
        </div>

        {usageRows.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-surface-border pt-5">
            <h2 className="text-sm font-medium">Utilisation</h2>
            {usageRows.map(([key, value]) => {
              const max = limits[key]!;
              const unlimited = max < 0;
              const ratio = unlimited ? 0 : Math.min(100, (value / max) * 100);

              return (
                <div key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">{LIMIT_LABELS[key]}</span>
                    <span>
                      {value} {unlimited ? '· illimité' : `/ ${max}`}
                    </span>
                  </div>
                  {!unlimited && (
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                      role="presentation"
                    >
                      <div
                        className={ratio >= 100 ? 'h-full bg-red-500' : 'h-full bg-ink'}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {entitlements.features.size > 0 && (
          <div className="mt-6 border-t border-surface-border pt-5">
            <h2 className="text-sm font-medium">Options incluses</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[...entitlements.features].map((feature) => (
                <li key={feature}>
                  <Badge tone="brand">
                    {FEATURE_LABELS[feature as Feature] ?? feature}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
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
        <SubscriptionPaymentFlow
          canManage={context.permissions.has('subscription:manage')}
          /* `screen.currentPlanKey` et non `entitlements.planKey` : le
             chargeur n'y met un plan que si l'accès est encore actif. En
             passant la clé brute, cette page marquait « Actuel » un plan
             expiré et lui retirait son bouton — le restaurateur ne pouvait
             pas reprendre le sien. Le mur, lui, lisait déjà la bonne valeur,
             d'où deux écrans qui se contredisaient. */
          currentPlanKey={screen.currentPlanKey}
          availableProviders={availableProviders}
          pendingPayment={pendingPayment}
          /* Mêmes plans, mêmes montants que le mur : un seul chargeur les
             forme (`lib/subscription-screen.ts`). Assemblés séparément, les
             deux écrans finiraient par annoncer des prix différents. */
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
                <a
                  href={`/recu/abonnement/${payment.id}`}
                  target="_blank"
                  className="shrink-0 text-xs font-medium text-brand underline underline-offset-4"
                >
                  Reçu
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
