import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { FEATURES, FEATURE_LABELS, type Feature, type PlanLimits } from '@/lib/entitlements';
import { PlansManager } from '@/components/admin/plans-manager';

export const metadata: Metadata = { title: 'Plans' };
export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  await requireSuperAdmin();

  const plans = await prisma.plan.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
      <p className="mt-1 text-sm text-white/60">
        Les tarifs et les limites vivent en base : une modification est
        immédiatement visible sur la landing page et dans les dashboards.
      </p>

      <div className="mt-6">
        <PlansManager
          availableFeatures={Object.values(FEATURES).map((feature) => ({
            value: feature,
            label: FEATURE_LABELS[feature as Feature],
          }))}
          plans={plans.map((plan) => ({
            id: plan.id,
            key: plan.key,
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
            subscriptionsCount: plan._count.subscriptions,
          }))}
        />
      </div>
    </>
  );
}
