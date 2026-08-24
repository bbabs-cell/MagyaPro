import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { cx } from '@/components/ui';
import { FEATURES, FEATURE_LABELS, type Feature, type PlanLimits } from '@/lib/entitlements';
import { STORE_FEATURES, STORE_FEATURE_LABELS, type StoreFeature } from '@/lib/boutique/entitlements';
import { PlansManager } from '@/components/admin/plans-manager';

export const metadata: Metadata = { title: 'Plans' };
export const dynamic = 'force-dynamic';

const TABS: Array<{ key: 'ALL' | 'RESTAURANT' | 'STORE'; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  { key: 'RESTAURANT', label: 'Restaurant' },
  { key: 'STORE', label: 'Boutique' },
];

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ produit?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.produit) ? (params.produit as (typeof TABS)[number]['key']) : 'ALL';

  const allPlans = await prisma.plan.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { subscriptions: true, storeSubscriptions: true } } },
  });
  const plans = tab === 'ALL' ? allPlans : allPlans.filter((plan) => plan.product === tab);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
      <p className="mt-1 text-sm text-white/60">
        Les tarifs et les limites vivent en base : une modification est
        immédiatement visible sur la landing page et dans les dashboards.
        Chaque plan appartient à un seul produit — Restaurant ou Boutique —
        leurs fonctionnalités et limites n&apos;ont pas le même sens.
      </p>

      <nav aria-label="Filtrer par produit" className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'ALL' ? '/admin/plans' : `/admin/plans?produit=${t.key}`}
            className={cx(
              'rounded-lg px-3 py-1.5 text-sm',
              tab === t.key ? 'bg-white text-ink' : 'border border-white/20 text-white/70 hover:bg-white/10',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <PlansManager
          restaurantFeatures={Object.values(FEATURES).map((feature) => ({
            value: feature,
            label: FEATURE_LABELS[feature as Feature],
          }))}
          storeFeatures={Object.values(STORE_FEATURES).map((feature) => ({
            value: feature,
            label: STORE_FEATURE_LABELS[feature as StoreFeature],
          }))}
          plans={plans.map((plan) => ({
            id: plan.id,
            key: plan.key,
            product: plan.product,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            interval: plan.interval,
            trialDays: plan.trialDays,
            features: plan.features,
            limits: (plan.limits ?? {}) as PlanLimits,
            isActive: plan.isActive,
            position: plan.position,
            subscriptionsCount: plan._count.subscriptions + plan._count.storeSubscriptions,
          }))}
        />
      </div>
    </>
  );
}
