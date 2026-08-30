import type { ReactNode } from 'react';
import Link from 'next/link';

import { formatMoney } from '@/lib/money';
import { Logo } from '@/components/ui/logo';

/**
 * Mur d'abonnement — affiché à la place du tableau de bord quand
 * l'abonnement n'est plus actif (essai terminé, délai de grâce écoulé).
 *
 * Partagé par Restaurant et Boutique : les deux produits appliquent la même
 * règle depuis que l'abonnement est obligatoire, seuls les plans proposés et
 * le lien de paiement diffèrent.
 *
 * Le ton compte autant que la règle : un commerçant bloqué doit comprendre en
 * une phrase que ses données sont intactes. Sans cette assurance, il n'appelle
 * pas pour payer, il appelle pour récupérer son stock.
 */

export type WallPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  features: string[];
  limits: Record<string, number | undefined>;
};

export function SubscriptionWall({
  tenantName,
  status,
  plans,
  subscribeHref,
  featureLabel,
  limitLabel,
  neverSubscribed = false,
  paymentSlot,
}: {
  tenantName: string;
  /** `TRIALING` n'arrive jamais ici : le mur ne s'affiche qu'une fois l'accès perdu. */
  status: string;
  /**
   * Vrai pour un espace qui n'a jamais eu de plan : une boutique
   * supplémentaire, ouverte sans période d'essai. Lui annoncer que « sa
   * période gratuite est terminée » et que « ses données l'attendent » serait
   * faux deux fois — elle n'a eu ni essai ni données.
   */
  neverSubscribed?: boolean;
  plans: WallPlan[];
  /** Page de paiement du produit concerné. */
  subscribeHref: string;
  featureLabel: (key: string) => string;
  limitLabel: (key: string) => string;
  /**
   * Formulaire de paiement affiché directement sur ce mur.
   *
   * Sans lui, l'écran se contente d'un lien vers la page d'abonnement : un
   * détour de plus pour quelqu'un qui est déjà bloqué et qui vient de lire
   * qu'il doit payer. Quand il est fourni, il remplace les cartes de
   * présentation et le lien — les cartes du formulaire portent les mêmes
   * plans, mais avec un bouton dessus.
   */
  paymentSlot?: ReactNode;
}) {
  const trialEnded = !neverSubscribed && (status === 'EXPIRED' || status === 'PAST_DUE');

  return (
    // `text-ink` explicite : sous `/boutique`, la mise en page parente impose
    // un fond sombre et un texte crème pour les pages publiques. Le mur, lui,
    // est clair. Sans cette couleur, tout ce qui n'a pas de classe de couleur
    // propre hérite du crème et devient illisible sur fond blanc.
    <div className="min-h-screen bg-surface-sunken text-ink">
      <div className="container-page py-12 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <Logo className="mx-auto h-9 w-auto" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {neverSubscribed
              ? 'Réglez cette boutique pour l’ouvrir'
              : trialEnded
                ? 'Votre période gratuite est terminée'
                : 'Abonnement requis'}
          </h1>
          <p className="mt-3 text-ink-muted">
            {neverSubscribed
              ? `${tenantName} est créée et vous appartient. Elle encaissera dès la validation de son paiement.`
              : `Choisissez un plan pour reprendre l’accès à ${tenantName}.`}
          </p>
          <p className="mt-4 rounded-xl bg-state-ok-soft px-4 py-3 text-sm text-state-ok">
            {neverSubscribed
              ? 'La boutique reste dans votre compte, rien n’est perdu. Elle s’ouvre entièrement dès que son paiement est validé.'
              : 'Vos données sont intactes : produits, stock, ventes et clients vous attendent. Tout redevient accessible dès la validation de votre paiement.'}
          </p>
        </header>

        {paymentSlot ? (
          <div className="mx-auto mt-10 max-w-3xl">
            {paymentSlot}
            <p className="mt-6 text-center text-sm text-ink-faint">
              Paiement par Wave ou Orange Money. L&apos;accès reprend dès que votre versement est
              validé.
            </p>
          </div>
        ) : (
          <>
        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          {plans.map((plan, index) => {
            const highlighted = index === plans.length - 1;
            return (
              <div
                key={plan.id}
                className={
                  highlighted
                    ? 'card relative overflow-hidden border-2 border-brand p-6'
                    : 'card p-6'
                }
              >
                {highlighted && (
                  <span className="absolute right-0 top-0 rounded-bl-xl bg-brand px-3 py-1 text-xs font-medium text-white">
                    Sans limite
                  </span>
                )}
                <h2 className="font-semibold text-ink">{plan.name}</h2>
                {plan.description && (
                  <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
                )}
                <p className="mt-4 text-2xl font-semibold text-ink">
                  {formatMoney(plan.price, plan.currency)}
                  <span className="text-sm font-normal text-ink-faint"> / mois</span>
                </p>

                <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                  {Object.entries(plan.limits).map(([key, value]) => (
                    <li key={key} className="flex gap-2">
                      <span aria-hidden="true" className="text-state-ok">✓</span>
                      <span>
                        {value === -1 || value === undefined
                          ? `${limitLabel(key)} en illimité`
                          : `Jusqu'à ${value} ${limitLabel(key).toLowerCase()}`}
                      </span>
                    </li>
                  ))}
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="text-state-ok">✓</span>
                      <span>{featureLabel(feature)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3">
          <Link
            href={subscribeHref}
            className="inline-flex h-12 items-center rounded-xl bg-brand px-7 text-sm font-medium text-white transition-[filter] hover:brightness-110"
          >
            Choisir un plan et payer
          </Link>
          <p className="text-center text-sm text-ink-faint">
            Paiement par Wave ou Orange Money. L&apos;accès reprend dès que votre versement est
            validé.
          </p>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
