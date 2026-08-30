import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import {
  additionalStorePrice,
  getAdditionalStorePercent,
  getGroupBillingTotals,
  getStoreBillingPlan,
} from '@/lib/boutique/store-pricing';
import { formatMoney } from '@/lib/money';
import { NewStoreForm } from '@/components/boutique/new-store-form';
import { Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Ajouter une boutique' };
export const dynamic = 'force-dynamic';

/**
 * Ouverture d'une boutique supplémentaire.
 *
 * L'écran dit trois choses avant le formulaire, dans cet ordre : ce que ça
 * coûte, ce que ça change à la facture totale, et le fait que la boutique ne
 * vend pas avant paiement. Un commerçant ne doit pas découvrir la deuxième
 * après avoir cliqué, ni la troisième le lendemain devant une caisse bloquée.
 */
export default async function NouvelleBoutiquePage() {
  const context = await requireStore('store:view');

  // Réservé au propriétaire. Un administrateur, un Super Admin en session de
  // support ou un visiteur en démonstration n'engagent pas une dépense
  // mensuelle au nom de quelqu'un d'autre — la route API refuse d'ailleurs
  // aussi, cette redirection évite seulement d'afficher un écran inutile.
  if (context.isSupportAccess || context.isDemoTour || context.role !== 'OWNER') {
    redirect('/boutique/dashboard');
  }

  const percent = await getAdditionalStorePercent();
  const [billingPlan, totals] = await Promise.all([
    getStoreBillingPlan(context.store.id),
    getGroupBillingTotals(context.store.id, percent),
  ]);

  // Un plan qui n'appartient pas au produit Boutique ne sert pas de base de
  // calcul : le prix annoncé serait celui d'un restaurant. On préfère ne rien
  // chiffrer et le dire.
  const plan = billingPlan.isForeignProduct ? null : billingPlan.plan;
  const currency = plan?.currency ?? context.store.currency;

  // Ce que coûtera la prochaine boutique, et le total qui en résultera. Le
  // total de départ vient des abonnements réellement en cours, pas du nombre
  // de boutiques : une boutique ouverte mais pas encore payée ne doit pas être
  // comptée dans ce que le commerçant paie aujourd'hui.
  const additional = plan ? additionalStorePrice(plan.price, percent) : null;
  const nextTotal = additional !== null ? totals.total + additional : null;

  return (
    <>
      <PageHeader
        title="Ajouter une boutique"
        description="Une deuxième adresse, un deuxième stock, une deuxième équipe. Le même compte pour tout piloter."
      />

      <Card className="p-5">
        {plan && additional !== null ? (
          <>
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              Coût de cette boutique
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">
              {formatMoney(additional, currency)}
              <span className="text-base font-normal text-ink-muted"> / mois</span>
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Soit {percent} % du tarif {plan.name} ({formatMoney(plan.price, currency)} par mois).
              Une boutique supplémentaire coûte moins cher que la première.
            </p>

            <dl className="mt-5 space-y-2 border-t border-surface-border pt-4 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">
                  Vous payez aujourd&apos;hui pour {totals.billed} boutique
                  {totals.billed > 1 ? 's' : ''}
                </dt>
                <dd className="tabular-nums text-ink">{formatMoney(totals.total, currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 font-medium">
                <dt className="text-ink">Après cet ajout</dt>
                <dd className="tabular-nums text-ink">{formatMoney(nextTotal!, currency)}</dd>
              </div>
            </dl>

            {totals.groupSize > totals.billed && (
              <p className="mt-3 text-xs text-ink-faint">
                {totals.groupSize - totals.billed} boutique
                {totals.groupSize - totals.billed > 1 ? 's ouvertes attendent' : ' ouverte attend'}{' '}
                encore son paiement et n&apos;{totals.groupSize - totals.billed > 1 ? 'entrent' : 'entre'}{' '}
                pas dans ce total.
              </p>
            )}
          </>
        ) : billingPlan.isForeignProduct ? (
          <>
            <p className="text-sm font-medium text-state-bad">
              Le plan rattaché à {context.store.name} n&apos;est pas un plan Boutique.
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Il s&apos;appelle « {billingPlan.plan!.name} » mais appartient au produit
              Restaurant. Chiffrer une boutique supplémentaire à partir de son tarif
              reviendrait à vous facturer au prix d&apos;un restaurant, c&apos;est pourquoi
              aucun montant n&apos;est affiché ici. Reprenez le plan de {context.store.name}
              depuis la page Abonnement, ou signalez-le à l&apos;assistance.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">
              Votre boutique actuelle n&apos;a pas encore de plan.
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Choisissez d&apos;abord un plan pour {context.store.name} : c&apos;est lui qui fixe
              le tarif de vos boutiques suivantes, facturées {percent} % de son montant.
            </p>
          </>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-medium text-ink">Avant de valider</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-muted">
          <li>
            Vous la configurez tout de suite (secteur, devise, taxe), puis son paiement vous est
            demandé. Elle n&apos;ouvre son tableau de bord et sa caisse qu&apos;une fois ce
            paiement validé. Aucune période d&apos;essai : l&apos;essai gratuit ne vaut que pour
            votre première boutique.
          </li>
          <li>
            Elle suit le plan de {context.store.name}. Pour en changer, changez-le sur cette
            boutique-là et toutes les autres suivront.
          </li>
          <li>
            Stock, ventes, clients et équipe sont entièrement séparés d&apos;une boutique à
            l&apos;autre. Seul votre compte est commun.
          </li>
        </ul>
      </Card>

      {plan ? (
        <NewStoreForm
          confirmLabel={`Créer la boutique (${formatMoney(additional!, currency)} / mois)`}
        />
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          Revenez ici une fois le plan de {context.store.name} réglé.
        </p>
      )}
    </>
  );
}
