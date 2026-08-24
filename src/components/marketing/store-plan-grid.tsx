import Link from 'next/link';
import type { Plan } from '@prisma/client';

import { formatMoney } from '@/lib/money';
import { STORE_FEATURE_LABELS, STORE_LIMIT_LABELS, type StoreFeature, type StorePlanLimits } from '@/lib/boutique/entitlements';

/**
 * Grille de plans MagyaPro Boutique — équivalent de `PlanGrid` (Restaurant),
 * avec l'identité visuelle propre à Boutique plutôt que les tokens
 * `ink`/`surface`/`brand` réservés à Restaurant (voir `src/app/boutique/layout.tsx`).
 */
export function StorePlanGrid({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <p className="mt-8 text-sm text-[#f3ece1]/60">
        Les offres sont en cours de préparation. Créez votre compte, nous vous informerons dès
        leur ouverture.
      </p>
    );
  }

  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {plans.map((plan, index) => {
        const limits = (plan.limits ?? {}) as StorePlanLimits;
        const highlighted = index === 1;
        const signupHref = `/boutique/inscription?plan=${encodeURIComponent(plan.key)}&planNom=${encodeURIComponent(plan.name)}`;

        return (
          <div
            key={plan.id}
            className={
              highlighted
                ? 'relative rounded-2xl border-2 border-[#e0bd52] bg-white/5 p-7'
                : 'rounded-2xl border border-white/10 bg-white/5 p-7'
            }
          >
            {highlighted && (
              <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-3 py-1 text-xs font-semibold text-[#1c1712]">
                Le plus choisi
              </span>
            )}
            <h3 className="font-semibold text-[#f3ece1]">{plan.name}</h3>
            {plan.description && <p className="mt-1 text-sm text-[#f3ece1]/60">{plan.description}</p>}
            <p className="mt-5">
              <span className="text-3xl font-semibold tracking-tight text-[#f3ece1]">
                {formatMoney(plan.price, plan.currency)}
              </span>
              <span className="text-sm text-[#f3ece1]/60">{plan.interval === 'MONTH' ? ' / mois' : ' / an'}</span>
            </p>
            {plan.trialDays > 0 && (
              <p className="mt-1 text-xs text-[#f3ece1]/45">{plan.trialDays} jours d&apos;essai inclus</p>
            )}

            <ul className="mt-6 space-y-2 text-sm">
              {Object.entries(limits).map(([key, value]) => (
                <li key={key} className="flex gap-2 text-[#f3ece1]/60">
                  <span aria-hidden="true" className="text-[#f3ece1]">·</span>
                  {value === -1
                    ? `${STORE_LIMIT_LABELS[key as keyof StorePlanLimits]} : illimité`
                    : `${STORE_LIMIT_LABELS[key as keyof StorePlanLimits]} : ${value}`}
                </li>
              ))}
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-[#f3ece1]">
                  <span aria-hidden="true" className="text-[#e0bd52]">✓</span>
                  {STORE_FEATURE_LABELS[feature as StoreFeature] ?? feature}
                </li>
              ))}
            </ul>

            <Link
              href={signupHref}
              className={
                highlighted
                  ? 'mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-4 text-sm font-semibold text-[#1c1712]'
                  : 'mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 px-4 text-sm font-medium text-[#f3ece1] hover:bg-white/10'
              }
            >
              Choisir {plan.name}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
