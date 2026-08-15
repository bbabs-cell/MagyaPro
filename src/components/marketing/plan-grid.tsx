import type { Plan } from '@prisma/client';

import { formatMoney } from '@/lib/money';
import { FEATURE_LABELS, LIMIT_LABELS, type Feature, type PlanLimits } from '@/lib/entitlements';
import { Badge, LinkButton } from '@/components/ui';

/**
 * Grille de plans, partagée entre l'aperçu de la page d'accueil et la page
 * tarifs dédiée — une seule définition de carte, jamais deux rendus qui
 * pourraient diverger.
 *
 * Le lien « Choisir » porte le plan choisi jusqu'à l'inscription
 * (`?plan=<clé>`) : `registerAccount` l'utilise à la place du plan par
 * défaut si la clé est valide et active.
 */
export function PlanGrid({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <p className="mt-8 text-sm text-ink-muted">
        Les offres sont en cours de préparation. Créez votre compte, nous
        vous informerons dès leur ouverture.
      </p>
    );
  }

  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {plans.map((plan, index) => {
        const limits = (plan.limits ?? {}) as PlanLimits;
        const highlighted = index === 1;
        const signupHref = `/inscription?plan=${encodeURIComponent(plan.key)}&planNom=${encodeURIComponent(plan.name)}`;

        return (
          <div
            key={plan.id}
            className={
              highlighted
                ? 'relative rounded-2xl border-2 border-brand bg-surface p-7 shadow-2xl'
                : 'rounded-2xl border border-surface-border bg-surface p-7'
            }
          >
            {highlighted && (
              <span className="absolute -top-3 left-6">
                <Badge tone="brand">Le plus choisi</Badge>
              </span>
            )}
            <h3 className="font-semibold text-ink">{plan.name}</h3>
            {plan.description && (
              <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
            )}
            <p className="mt-5">
              <span className="text-3xl font-semibold tracking-tight">
                {formatMoney(plan.price, plan.currency)}
              </span>
              <span className="text-sm text-ink-muted">
                {plan.interval === 'MONTH' ? ' / mois' : ' / an'}
              </span>
            </p>
            {plan.trialDays > 0 && (
              <p className="mt-1 text-xs text-ink-faint">
                {plan.trialDays} jours d&apos;essai inclus
              </p>
            )}

            <ul className="mt-6 space-y-2 text-sm">
              {Object.entries(limits).map(([key, value]) => (
                <li key={key} className="flex gap-2 text-ink-muted">
                  <span aria-hidden="true" className="text-ink">·</span>
                  {value === -1
                    ? `${LIMIT_LABELS[key as keyof PlanLimits]} : illimité`
                    : `${LIMIT_LABELS[key as keyof PlanLimits]} : ${value}`}
                </li>
              ))}
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-ink">
                  <span aria-hidden="true" className="text-brand">✓</span>
                  {FEATURE_LABELS[feature as Feature] ?? feature}
                </li>
              ))}
            </ul>

            <LinkButton
              href={signupHref}
              variant={highlighted ? 'primary' : 'secondary'}
              className="mt-6 w-full"
            >
              Choisir {plan.name}
            </LinkButton>
          </div>
        );
      })}
    </div>
  );
}
