'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, cx } from '@/components/ui';

type Plan = {
  key: string;
  name: string;
  description: string | null;
  priceLabel: string;
  interval: 'MONTH' | 'YEAR';
  trialDays: number;
  features: string[];
  limits: string[];
};

export function SubscriptionPanel({
  plans,
  currentPlanKey,
  canManage,
}: {
  plans: Plan[];
  currentPlanKey: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function choose(plan: Plan) {
    if (
      !window.confirm(
        `Passer au plan ${plan.name} (${plan.priceLabel} / ${plan.interval === 'MONTH' ? 'mois' : 'an'}) ?`,
      )
    ) {
      return;
    }

    setPending(plan.key);
    setError(null);
    setMessage(null);

    try {
      await api.post('/api/abonnement', { planKey: plan.key });
      setMessage(`Vous êtes maintenant sur le plan ${plan.name}.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Le plan n'a pas pu être changé.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium">Plans disponibles</h2>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlanKey;

          return (
            <Card
              key={plan.key}
              className={cx('p-5', isCurrent && 'border-ink ring-1 ring-ink')}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {isCurrent && <Badge tone="brand">Actuel</Badge>}
              </div>

              {plan.description && (
                <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
              )}

              <p className="mt-4">
                <span className="text-2xl font-semibold tracking-tight">
                  {plan.priceLabel}
                </span>
                <span className="text-sm text-ink-muted">
                  {plan.interval === 'MONTH' ? ' / mois' : ' / an'}
                </span>
              </p>

              <ul className="mt-4 space-y-1.5 text-sm">
                {plan.limits.map((limit) => (
                  <li key={limit} className="text-ink-muted">
                    · {limit}
                  </li>
                ))}
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden="true" className="text-brand">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {canManage && !isCurrent && (
                <Button
                  className="mt-5 w-full"
                  disabled={pending !== null}
                  onClick={() => choose(plan)}
                >
                  {pending === plan.key ? 'Changement…' : `Choisir ${plan.name}`}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
