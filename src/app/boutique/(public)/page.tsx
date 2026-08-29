import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getActivePromo } from '@/lib/platform-settings';
import {
  BOUTIQUE_SECTORS,
  boutiqueHowItWorksImageUrl,
  boutiqueLandingAssetUrl,
  boutiqueSectorImageUrl,
} from '@/lib/storage';
import { StorePlanGrid } from '@/components/marketing/store-plan-grid';
import { PromoBanner } from '@/components/marketing/promo-banner';
import { DemoTourButton } from '@/components/boutique/demo-tour-button';
import { SECTOR_LABELS } from '@/lib/boutique/unit-catalogue';

export const metadata: Metadata = {
  title: 'MagyaPro Boutique — Caisse et stock au carton comme à l’unité',
  description:
    'Caisse tactile et gestion de stock pour commerces : vente au carton, au sac, au mètre ou au kilo, prévision des ruptures et encaissement même sans connexion.',
};
export const dynamic = 'force-dynamic';

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

const FEATURE_ICONS: Record<string, React.ReactElement> = {
  pos: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.6" />
    </svg>
  ),
  stock: (
    <svg {...ICON_PROPS}>
      <path d="M3 8l9-5 9 5-9 5-9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  ),
  purchases: (
    <svg {...ICON_PROPS}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  customers: (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  ),
  finances: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15.5c.5 1 1.5 1.5 3 1.5s3-1 3-2.2-1-1.8-3-2.3-3-1.1-3-2.3 1.5-2.2 3-2.2 2.5.5 3 1.5" />
      <path d="M12 6.5v11" />
    </svg>
  ),
  reports: (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  ),
  promotions: (
    <svg {...ICON_PROPS}>
      <path d="M20 12 12.5 19.5a2 2 0 0 1-2.8 0L4 13.8a2 2 0 0 1 0-2.8L11.5 3.5H18a2 2 0 0 1 2 2V12Z" />
      <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  multistore: (
    <svg {...ICON_PROPS}>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M4 9h16" />
    </svg>
  ),
  security: (
    <svg {...ICON_PROPS}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9.5 12l1.8 1.8 3.2-3.6" />
    </svg>
  ),
};

export default async function BoutiqueLandingPage() {
  const [plans, promo, demos] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true, product: 'STORE' }, orderBy: { position: 'asc' } }),
    getActivePromo(),
    prisma.store.findMany({
      where: { isDemo: true, status: 'ACTIVE' },
      select: { name: true, slug: true, description: true, businessType: true, primaryColor: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const logoUrl = boutiqueLandingAssetUrl();

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
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
          className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-[#c2603d] opacity-30 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-[#e0bd52] opacity-20 blur-[110px]"
        />

        <div className="container-page relative py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image de plateforme, hôte de stockage arbitraire
              <img src={logoUrl} alt="" className="mx-auto h-14 w-14 object-contain sm:h-16 sm:w-16" />
            ) : (
              <span
                aria-hidden="true"
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-[#c2603d] to-[#e0bd52] text-xl font-bold text-[#1c1712] sm:h-16 sm:w-16"
              >
                M
              </span>
            )}
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-[#f3ece1]/80 backdrop-blur">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#e0bd52]" />
              Caisse et stock pour commerces d&apos;Afrique de l&apos;Ouest
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#f3ece1] sm:text-6xl lg:text-7xl">
              Vendez au carton{' '}
              <span className="bg-gradient-to-r from-[#c2603d] to-[#e0bd52] bg-clip-text text-transparent">
                comme à l&apos;unité
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-[#f3ece1]/70 sm:text-lg">
              La caisse qui compte votre stock dans vos vraies unités — carton de 12, sac de
              25 kg, tissu au mètre, chaussures par pointure. Et qui continue d&apos;encaisser
              quand le réseau tombe.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/boutique/inscription"
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-8 text-sm font-semibold text-[#1c1712] shadow-[0_10px_40px_-10px_rgba(224,189,82,0.5)] transition-transform hover:scale-[1.03] sm:w-auto"
              >
                Commencer gratuitement
              </Link>
              <Link
                href="/boutique#fonctionnement"
                className="inline-flex h-14 w-full items-center justify-center rounded-full border border-white/20 px-8 text-sm font-medium text-[#f3ece1] transition-colors hover:bg-white/10 sm:w-auto"
              >
                Découvrir MagyaPro Boutique
              </Link>
            </div>
            <p className="mt-5 text-xs text-[#f3ece1]/50">
              1 mois gratuit · Sans carte bancaire · Fonctionne sans connexion
            </p>
            {promo && (
              <div className="mt-5">
                <PromoBanner discountPercent={promo.discountPercent} endsAt={promo.endsAt} label={promo.label} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Présentation */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#f3ece1] sm:text-3xl">
              Un logiciel de facturation ne connaît pas votre rayon.
            </h2>
            <p className="mt-4 text-[#f3ece1]/65">
              Il sait éditer une facture. Il ne sait pas qu&apos;un carton contient douze
              bouteilles, que le prix du carton n&apos;est pas douze fois celui de la
              bouteille, ni que votre client repart avec trois bouteilles et un carton dans
              la même vente. MagyaPro est construit autour de ça.
            </p>
            <dl className="mt-8 space-y-5">
              {[
                {
                  term: 'Vos unités, pas les nôtres',
                  detail: 'Carton, sac, bidon, rouleau, mètre, kilo, paire — avec un prix propre à chaque conditionnement. Le stock reste juste, quelle que soit la façon dont vous vendez.',
                },
                {
                  term: 'La vente passe même sans réseau',
                  detail: 'Vous encaissez hors connexion ; tout se synchronise au retour du signal. Une coupure n\'arrête pas votre journée.',
                },
                {
                  term: 'Chaque vente compte',
                  detail: 'La caisse décrémente le stock en temps réel — jamais de vente enregistrée sans mouvement correspondant.',
                },
                {
                  term: 'Vos données vous appartiennent',
                  detail: 'Votre catalogue, vos clients et votre chiffre d\'affaires restent isolés de ceux des autres boutiques.',
                },
              ].map((item) => (
                <div key={item.term} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#e0bd52]" />
                  <div>
                    <dt className="font-medium text-[#f3ece1]">{item.term}</dt>
                    <dd className="mt-0.5 text-sm text-[#f3ece1]/60">{item.detail}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-medium uppercase tracking-wide text-[#f3ece1]/40">
                Sur tous vos écrans
              </p>
              <p className="mt-2 text-lg text-[#f3ece1]">
                Téléphone, tablette ou ordinateur — la{' '}
                <span className="bg-gradient-to-r from-[#c2603d] to-[#e0bd52] bg-clip-text text-transparent">
                  même caisse
                </span>
                , la même boutique.
              </p>
              <p className="mt-3 text-sm text-[#f3ece1]/60">
                Rien à installer : vous ouvrez MagyaPro dans votre navigateur et vous encaissez.
                Le stock reste le même d&apos;un appareil à l&apos;autre.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Fonctionnement */}
      <section id="fonctionnement" className="relative overflow-hidden bg-black/20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle, #f3ece1 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="container-page relative py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Le parcours</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">Comment ça fonctionne</h2>
            <p className="mt-3 text-[#f3ece1]/60">Quatre étapes, guidées de bout en bout.</p>
          </div>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: 1 as const, title: 'Créez votre compte', detail: 'Nom, email, mot de passe. Rien de plus.' },
              { step: 2 as const, title: 'Configurez votre boutique', detail: 'Secteur d\'activité, devise, taxe, langue.' },
              { step: 3 as const, title: 'Ajoutez vos produits', detail: 'Catégories, variantes, prix, stock de départ.' },
              { step: 4 as const, title: 'Vendez', detail: 'Caisse ouverte, votre boutique est prête à encaisser.' },
            ].map((item) => {
              const imageUrl = boutiqueHowItWorksImageUrl(item.step);
              return (
                <li
                  key={item.step}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-colors hover:border-white/25"
                >
                  <div className="relative h-40 w-full">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- illustration de plateforme, hôte de stockage arbitraire
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-[#c2603d]/50 to-[#e0bd52]/30" />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
                    />
                    <span className="absolute bottom-3 left-4 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#c2603d] to-[#e0bd52] text-sm font-bold text-[#1c1712] shadow-lg">
                      {item.step}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-[#f3ece1]">{item.title}</h3>
                    <p className="mt-1 text-sm text-[#f3ece1]/55">{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- Fonctionnalités */}
      <section id="fonctionnalites" className="container-page py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Fonctionnalités</span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">
            Tout ce qu&apos;il faut pour vendre
          </h2>
          <p className="mt-3 text-[#f3ece1]/60">Pensé pour la réalité d&apos;une boutique : rapide en caisse, clair en fin de journée.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            // Les trois premières cartes portent ce qu'un logiciel de
            // facturation généraliste ne sait pas faire. Le reste, indispensable
            // mais attendu, vient après.
            { title: 'Vente au carton et à l\'unité', detail: 'Un carton de 12, un sac de 25 kg, du tissu au mètre — avec un prix propre à chaque conditionnement, jamais un simple calcul.', icon: FEATURE_ICONS.stock },
            { title: 'Vente hors connexion', detail: 'La caisse continue quand le réseau tombe. Tout se synchronise dès qu\'il revient.', icon: FEATURE_ICONS.pos },
            { title: 'Ruptures annoncées à l\'avance', detail: 'MagyaPro calcule votre rythme de vente et vous dit quoi recommander, avant que le rayon soit vide.', icon: FEATURE_ICONS.reports },
            { title: 'Dates de péremption', detail: 'Les produits proches de leur date passent en orange, les périmés en rouge — sans ouvrir une seule fiche.', icon: FEATURE_ICONS.stock },
            { title: 'Caisse tactile', detail: 'Scan code-barres par la caméra, remises, TVA, paiements multiples et fractionnés.', icon: FEATURE_ICONS.pos },
            { title: 'Achats & fournisseurs', detail: 'Commandes, réceptions, coût d\'achat moyen, dettes fournisseurs.', icon: FEATURE_ICONS.purchases },
            { title: 'Clients & crédit', detail: 'Fichier client, vente à crédit, historique des paiements.', icon: FEATURE_ICONS.customers },
            { title: 'Caisses & finances', detail: 'Ouverture/fermeture de caisse, dépenses, bénéfice net.', icon: FEATURE_ICONS.finances },
            { title: 'Analyses automatiques', detail: 'Capital immobilisé, produits qui dorment, marges réelles, ventes à perte.', icon: FEATURE_ICONS.reports },
            { title: 'Promotions', detail: 'Codes promo en pourcentage ou montant, avec dates et limites d\'usage.', icon: FEATURE_ICONS.promotions },
            { title: 'Multi-boutique', detail: 'Plusieurs points de vente, vue consolidée pour les propriétaires.', icon: FEATURE_ICONS.multistore },
            { title: 'Double authentification', detail: 'Sécurisez la connexion de votre équipe avec un code à usage unique.', icon: FEATURE_ICONS.security },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:-translate-y-1 hover:border-white/20"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#c2603d]/30 to-[#e0bd52]/30 text-[#e0bd52]">
                {feature.icon}
              </span>
              <h3 className="mt-4 font-semibold text-[#f3ece1]">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-[#f3ece1]/60">{feature.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Secteurs */}
      <section id="secteurs" className="border-y border-white/10 bg-black/20">
        <div className="container-page py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Secteurs</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">
              Pensé pour votre activité
            </h2>
            <p className="mt-3 text-[#f3ece1]/60">
              Habillement, électronique, cosmétique, alimentation — le même outil s&apos;adapte à
              votre catalogue.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BOUTIQUE_SECTORS.map((sector) => {
              const imageUrl = boutiqueSectorImageUrl(sector);
              return (
                <div
                  key={sector}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-colors hover:border-white/25"
                >
                  <div className="relative h-32 w-full">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- illustration de plateforme, hôte de stockage arbitraire
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-[#c2603d]/50 to-[#e0bd52]/30" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-[#f3ece1]">{SECTOR_LABELS[sector]}</h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Démonstrations */}
      {demos.length > 0 && (
        <section className="container-page py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Exemples</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">
              Voir MagyaPro Boutique en situation
            </h2>
            <p className="mt-3 text-[#f3ece1]/60">
              Ces boutiques sont des exemples créés pour la démonstration. Elles fonctionnent
              exactement comme la vôtre fonctionnera.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {demos.map((demo) => (
              <div
                key={demo.slug}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/20"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-10 w-10 rounded-xl shadow-sm"
                  style={{ backgroundColor: demo.primaryColor }}
                />
                <h3 className="mt-4 font-semibold text-[#f3ece1]">{demo.name}</h3>
                <p className="mt-0.5 text-xs text-[#f3ece1]/50">{SECTOR_LABELS[demo.businessType] ?? demo.businessType}</p>
                {demo.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-[#f3ece1]/60">{demo.description}</p>
                )}
                <div className="mt-4">
                  <DemoTourButton
                    slug={demo.slug}
                    className="block w-full rounded-lg bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-3 py-2 text-center text-sm font-semibold text-[#1c1712] transition-transform hover:scale-[1.02] disabled:opacity-60"
                  >
                    Explorer le tableau de bord
                  </DemoTourButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Tarifs */}
      <section id="tarifs" className="border-y border-white/10 bg-black/20">
        <div className="container-page py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Tarifs</span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">Des tarifs lisibles</h2>
              <p className="mt-3 text-[#f3ece1]/60">Chaque plan démarre par une période d&apos;essai. Sans engagement.</p>
            </div>
            <Link href="/boutique/tarifs" className="text-sm font-medium text-[#e0bd52] underline-offset-4 hover:underline">
              Voir tous les détails →
            </Link>
          </div>

          {promo && (
            <div className="mt-6">
              <PromoBanner discountPercent={promo.discountPercent} endsAt={promo.endsAt} label={promo.label} />
            </div>
          )}

          <StorePlanGrid plans={plans} />
        </div>
      </section>

      {/* ------------------------------------------------------------------- FAQ */}
      <section id="faq" className="container-page py-16 sm:py-24">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0bd52]">Questions</span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">Questions fréquentes</h2>
        <div className="mt-10 max-w-3xl divide-y divide-white/10 border-y border-white/10">
          {[
            {
              q: 'Faut-il des connaissances techniques ?',
              a: 'Non. Vous configurez votre boutique depuis votre téléphone ou votre ordinateur, en quelques étapes guidées.',
            },
            {
              q: 'Combien de temps pour démarrer ?',
              a: 'Le temps de créer votre compte et vos premiers produits — généralement moins d\'une demi-heure.',
            },
            {
              q: 'Puis-je utiliser MagyaPro sur plusieurs appareils ?',
              a: 'Oui. Téléphone, tablette ou ordinateur : le catalogue, le stock et les ventes sont les mêmes partout, mis à jour au fur et à mesure.',
            },
            {
              q: 'Je vends au carton et à l’unité, avec des prix différents. C’est possible ?',
              a: 'C’est précisément ce pour quoi MagyaPro a été conçu. Vous déclarez qu’un carton contient 12 bouteilles, puis vous saisissez le prix du carton ET le prix de la bouteille — ils sont indépendants, le prix du carton n’est jamais un simple calcul. En caisse, vous choisissez l’un ou l’autre ; le stock reste juste dans les deux cas.',
            },
            {
              q: 'Que se passe-t-il si je perds la connexion en pleine vente ?',
              a: 'Vous continuez à encaisser. La vente est enregistrée sur l’appareil et part automatiquement dès que le réseau revient. Une coupure n’arrête pas votre journée.',
            },
            {
              q: 'Comment mes clients paient-ils ?',
              a: 'Vous configurez vous-même les moyens de paiement acceptés en caisse (espèces, mobile money, carte...) depuis vos réglages.',
            },
            {
              q: 'Mes données sont-elles isolées des autres boutiques ?',
              a: 'Oui. Chaque boutique constitue un espace indépendant. Aucune boutique ne peut consulter les ventes, les clients ou le stock d\'une autre.',
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
      </section>

      {/* -------------------------------------------------------------- CTA final */}
      <section className="relative overflow-hidden border-t border-white/10 bg-[#1c1712]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[#e0bd52] opacity-15 blur-[110px]"
        />
        <div className="container-page relative py-20 text-center sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight text-[#f3ece1] sm:text-4xl">
            Votre boutique, prête à vendre dès aujourd&apos;hui.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[#f3ece1]/65">
            Créez votre compte, ajoutez vos produits, ouvrez la caisse. Vous pourrez tout
            modifier ensuite.
          </p>
          <div className="mt-9">
            <Link
              href="/boutique/inscription"
              className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-9 text-sm font-semibold text-[#1c1712] shadow-[0_10px_40px_-10px_rgba(224,189,82,0.5)] transition-transform hover:scale-[1.03]"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
