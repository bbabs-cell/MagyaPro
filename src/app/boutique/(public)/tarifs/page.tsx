import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getActivePromo } from '@/lib/platform-settings';
import { StorePlanGrid } from '@/components/marketing/store-plan-grid';
import { PromoBanner } from '@/components/marketing/promo-banner';
import { additionalStorePrice, getAdditionalStorePercent } from '@/lib/boutique/store-pricing';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = {
  title: 'Tarifs — MagyaPro Boutique',
  description:
    'Des tarifs lisibles pour votre boutique : chaque plan démarre par une période d\'essai, sans engagement.',
};
export const dynamic = 'force-dynamic';

export default async function BoutiqueTarifsPage() {
  const [plans, promo, additionalPercent] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true, product: 'STORE' }, orderBy: { position: 'asc' } }),
    getActivePromo(),
    getAdditionalStorePercent(),
  ]);

  // Exemples calculés à partir des plans réels et de la majoration en vigueur.
  // Un tarif annoncé sur une page publique ne doit jamais être une valeur
  // recopiée à la main : elle finirait par mentir après un changement de prix.
  const multiStoreRows = plans
    .filter((plan) => plan.price > 0)
    .map((plan) => ({
      key: plan.key,
      name: plan.name,
      first: formatMoney(plan.price, plan.currency),
      extra: formatMoney(additionalStorePrice(plan.price, additionalPercent), plan.currency),
      two: formatMoney(
        plan.price + additionalStorePrice(plan.price, additionalPercent),
        plan.currency,
      ),
    }));

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[#1c1712]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #f3ece1 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#e0bd52] opacity-20 blur-[110px]"
        />
        <div className="container-page relative py-16 text-center sm:py-24">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Tarifs</span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-[#f3ece1] sm:text-5xl">
            Un tarif clair, sans surprise.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[#f3ece1]/65">
            Chaque plan démarre par une période d&apos;essai, sans engagement ni carte bancaire.
            Changez de plan à tout moment depuis votre tableau de bord.
          </p>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        {promo && (
          <div className="mb-8 flex justify-center">
            <PromoBanner discountPercent={promo.discountPercent} endsAt={promo.endsAt} label={promo.label} />
          </div>
        )}
        <StorePlanGrid plans={plans} />
      </section>

      {multiStoreRows.length > 0 && (
        <section className="border-t border-white/10 bg-black/20">
          <div className="container-page py-16 sm:py-20">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-3xl">
              Plusieurs boutiques sur le même compte
            </h2>
            <p className="mt-4 max-w-[65ch] text-[#f3ece1]/65">
              Vous pouvez ouvrir une boutique de plus à tout moment, depuis votre tableau de
              bord. Chacune garde son stock, ses ventes et son équipe ; vous passez de l&apos;une
              à l&apos;autre en un geste et vous suivez le total sur un seul écran. Une boutique
              supplémentaire coûte {additionalPercent} % du tarif de votre plan, pas un
              abonnement entier.
            </p>

            <div className="mt-8 overflow-x-auto">
              <table className="table-stack w-full max-w-2xl border-collapse text-sm">
                <caption className="sr-only">
                  Tarif d&apos;une boutique supplémentaire selon le plan
                </caption>
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-[#f3ece1]/40">
                    <th scope="col" className="py-3 pr-4 font-medium">Plan</th>
                    <th scope="col" className="py-3 pr-4 font-medium">1 boutique</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Boutique en plus</th>
                    <th scope="col" className="py-3 font-medium">2 boutiques</th>
                  </tr>
                </thead>
                <tbody>
                  {multiStoreRows.map((row) => (
                    <tr key={row.key} className="border-b border-white/10 text-[#f3ece1]">
                      <td data-label="Plan" className="py-3 pr-4 font-medium">{row.name}</td>
                      <td data-label="1 boutique" className="py-3 pr-4 tabular-nums">{row.first}</td>
                      <td data-label="Boutique en plus" className="py-3 pr-4 tabular-nums">
                        + {row.extra}
                      </td>
                      <td data-label="2 boutiques" className="py-3 font-medium tabular-nums">
                        {row.two}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 max-w-[65ch] text-sm text-[#f3ece1]/55">
              Montants par mois. Chaque boutique en plus ajoute toujours le même supplément.
              L&apos;essai gratuit vaut pour votre première boutique ; les suivantes se règlent
              dès leur ouverture.
            </p>
          </div>
        </section>
      )}

      <section className="border-t border-white/10 bg-black/20">
        <div className="container-page py-16 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-3xl">Questions sur les tarifs</h2>
          <div className="mt-8 max-w-3xl divide-y divide-white/10 border-y border-white/10">
            {[
              {
                q: 'Puis-je changer de plan plus tard ?',
                a: 'Oui, à tout moment depuis votre tableau de bord (Abonnement). Le changement prend effet immédiatement.',
              },
              {
                q: 'Que se passe-t-il à la fin de l\'essai ?',
                a: 'Votre plan reste actif : aucun paiement automatique n\'est déclenché tant qu\'aucun moyen de paiement n\'est configuré.',
              },
              {
                q: 'Je veux ouvrir une deuxième boutique. Comment ça se passe ?',
                a: `Depuis votre tableau de bord, en haut de la barre latérale : « Ajouter une boutique ». Elle est créée aussitôt, avec son propre stock et sa propre équipe, et vous coûte ${additionalPercent} % du tarif de votre plan en plus de ce que vous payez déjà. Elle n'encaisse qu'une fois son paiement validé : l'essai gratuit ne vaut que pour la première boutique.`,
              },
              {
                q: 'Mes boutiques peuvent-elles avoir des plans différents ?',
                a: 'Non, elles suivent toutes le plan de votre boutique principale. Changez-le sur celle-ci et les autres suivent, au tarif majoré qui leur correspond.',
              },
              {
                q: 'Puis-je résilier à tout moment ?',
                a: 'Oui, sans préavis ni pénalité. Votre accès reste ouvert jusqu\'à la fin de la période déjà couverte.',
              },
            ].map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-[#f3ece1]">
                  {item.q}
                  <span aria-hidden="true" className="shrink-0 text-[#f3ece1]/40 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-[#f3ece1]/60">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
