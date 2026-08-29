import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import {
  additionalStorePrice,
  getAdditionalStorePercent,
  getStoreBillingPosition,
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

  const [subscription, percent, position] = await Promise.all([
    prisma.storeSubscription.findUnique({
      where: { storeId: context.store.id },
      include: { plan: true },
    }),
    getAdditionalStorePercent(),
    getStoreBillingPosition(context.store.id),
  ]);

  const plan = subscription?.plan ?? null;
  const currency = plan?.currency ?? context.store.currency;

  // Ce que coûtera la prochaine boutique, et le total qui en résultera. Les
  // boutiques déjà ouvertes au-delà de la première paient déjà la majoration :
  // le total la compte pour chacune d'elles.
  const additional = plan ? additionalStorePrice(plan.price, percent) : null;
  const currentTotal = plan ? plan.price + additional! * (position.groupSize - 1) : null;
  const nextTotal = currentTotal !== null ? currentTotal + additional! : null;

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
                  Vous payez aujourd&apos;hui pour {position.groupSize} boutique
                  {position.groupSize > 1 ? 's' : ''}
                </dt>
                <dd className="tabular-nums text-ink">{formatMoney(currentTotal!, currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 font-medium">
                <dt className="text-ink">Après cet ajout</dt>
                <dd className="tabular-nums text-ink">{formatMoney(nextTotal!, currency)}</dd>
              </div>
            </dl>
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
          Revenez ici une fois le plan de {context.store.name} choisi.
        </p>
      )}
    </>
  );
}
