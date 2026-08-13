import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { getEntitlements, FEATURE_LABELS, LIMIT_LABELS, type Feature, type PlanLimits } from '@/lib/entitlements';
import { formatMoney } from '@/lib/money';
import { SubscriptionPanel } from '@/components/dashboard/subscription-panel';
import { Badge, Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Abonnement' };
export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  TRIALING: "Période d'essai",
  ACTIVE: 'Actif',
  PAST_DUE: 'Paiement en retard',
  CANCELLED: 'Résilié',
  EXPIRED: 'Expiré',
};

export default async function SubscriptionPage() {
  const context = await requireTenant('subscription:view');

  const [entitlements, plans, usage] = await Promise.all([
    getEntitlements(context.restaurant.id),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
    Promise.all([
      prisma.product.count({ where: { restaurantId: context.restaurant.id } }),
      prisma.category.count({ where: { restaurantId: context.restaurant.id } }),
      prisma.restaurantUser.count({ where: { restaurantId: context.restaurant.id } }),
    ]),
  ]);

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
                {STATUS_LABELS[entitlements.status] ?? entitlements.status}
              </Badge>
            </p>
          </div>

          {entitlements.currentPeriodEnd && (
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
            </div>
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

      <div className="mt-6">
        <SubscriptionPanel
          canManage={context.permissions.has('subscription:manage')}
          currentPlanKey={entitlements.planKey}
          plans={plans.map((plan) => ({
            key: plan.key,
            name: plan.name,
            description: plan.description,
            priceLabel: formatMoney(plan.price, plan.currency),
            interval: plan.interval,
            trialDays: plan.trialDays,
            features: plan.features.map(
              (feature) => FEATURE_LABELS[feature as Feature] ?? feature,
            ),
            limits: Object.entries((plan.limits ?? {}) as PlanLimits).map(
              ([key, value]) =>
                `${LIMIT_LABELS[key as keyof PlanLimits]} : ${value === -1 ? 'illimité' : value}`,
            ),
          }))}
        />
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Le règlement des abonnements n&apos;est pas encore automatisé sur cette
        instance : un changement de plan est enregistré immédiatement et fait
        l&apos;objet d&apos;une facturation hors plateforme.
      </p>
    </>
  );
}
