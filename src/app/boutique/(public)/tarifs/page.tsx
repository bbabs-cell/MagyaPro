import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getActivePromo } from '@/lib/platform-settings';
import { StorePlanGrid } from '@/components/marketing/store-plan-grid';
import { PromoBanner } from '@/components/marketing/promo-banner';

export const metadata: Metadata = {
  title: 'Tarifs — MagyaPro Boutique',
  description:
    'Des tarifs lisibles pour votre boutique : chaque plan démarre par une période d\'essai, sans engagement.',
};
export const dynamic = 'force-dynamic';

export default async function BoutiqueTarifsPage() {
  const [plans, promo] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true, product: 'STORE' }, orderBy: { position: 'asc' } }),
    getActivePromo(),
  ]);

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
