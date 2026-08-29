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
import { Ticket } from '@/components/marketing/ticket';
import { PromoBanner } from '@/components/marketing/promo-banner';
import { DemoTourButton } from '@/components/boutique/demo-tour-button';
import { SECTOR_LABELS } from '@/lib/boutique/unit-catalogue';

export const metadata: Metadata = {
  title: 'MagyaPro Boutique : caisse et stock au carton comme à l’unité',
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
  reports: (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
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
        <div className="container-page relative py-20 sm:py-24 lg:py-28">
          {/* Deux colonnes plutôt qu'un bloc centré : le texte pose la
              promesse, le ticket la prouve, côte à côte. Centré, il aurait
              fallu faire défiler pour arriver à la preuve. */}
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image de plateforme, hôte de stockage arbitraire
                  <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e0bd52] font-display text-lg font-bold text-[#1c1712]"
                  >
                    M
                  </span>
                )}
                <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#e0bd52]">
                  MagyaPro Boutique
                </span>
              </div>

              {/* Le mot « carton » est composé dans la police du ticket : le
                  titre et l'objet qu'il décrit parlent la même langue. Il
                  remplace le mot en dégradé, motif qu'on trouve sur la moitié
                  des pages de logiciels. */}
              <h1 className="mt-8 font-display text-[2.75rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-[#f3ece1] sm:text-6xl lg:text-[4.25rem]">
                Vendez au
                <span className="mt-1 block font-mono text-[2.25rem] font-medium tracking-[-0.01em] text-[#e0bd52] sm:text-5xl lg:text-[3.5rem]">
                  carton
                </span>
                comme à l&apos;unité.
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-[#f3ece1]/70 sm:text-lg">
                La caisse qui compte votre stock dans vos vraies unités : carton, sac, mètre,
                kilo. Elle encaisse même quand le réseau tombe.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/boutique/inscription"
                  className="inline-flex items-center justify-center rounded-xl bg-[#e0bd52] px-7 py-4 font-display text-sm font-semibold text-[#1c1712] transition-colors hover:bg-[#eccb63]"
                >
                  Commencer gratuitement
                </Link>
                <Link
                  href="/boutique#fonctionnement"
                  className="inline-flex items-center justify-center rounded-xl border border-[#f3ece1]/20 px-7 py-4 font-display text-sm font-medium text-[#f3ece1] transition-colors hover:bg-[#f3ece1]/5"
                >
                  Voir comment ça marche
                </Link>
              </div>

              {promo && (
                <div className="mt-6">
                  <PromoBanner discountPercent={promo.discountPercent} endsAt={promo.endsAt} label={promo.label} />
                </div>
              )}
            </div>

            {/* Élément signature. Ce ticket EST l'argument : le même produit y
                part en bouteilles ET en carton, à deux prix indépendants.
                Aucune phrase publicitaire ne dit cela aussi vite. */}
            <div className="justify-self-center lg:justify-self-end">
              <Ticket
                tone="kraft"
                header="Marché du Coin"
                meta="Ticket n°412 · 18:07"
                lines={[
                  { kind: 'item', label: 'Eau minérale 1,5 L', detail: '3 bouteilles × 500', amount: '1 500' },
                  { kind: 'item', label: 'Eau minérale 1,5 L', detail: '1 carton de 12', amount: '5 400' },
                  { kind: 'item', label: 'Riz parfumé', detail: '2 kg × 900', amount: '1 800' },
                  { kind: 'rule' },
                  { kind: 'total', label: 'Total', amount: '8 700' },
                  { kind: 'item', label: 'Espèces', amount: '10 000' },
                  { kind: 'item', label: 'Rendu', amount: '1 300' },
                  { kind: 'rule' },
                  { kind: 'note', text: '12 bouteilles sorties du stock' },
                ]}
                footer="Merci de votre visite"
              />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Présentation */}
      {/* Les trois assurances qui figuraient sous les boutons du hero. Elles
          rassurent, mais elles n'ont pas leur place dans le premier écran : le
          hero doit tenir la promesse et le bouton, rien d'autre. */}
      <section className="container-page pt-12">
        <ul className="flex flex-wrap gap-x-8 gap-y-2 border-y border-white/10 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f3ece1]/50">
          <li>1 mois gratuit</li>
          <li>Sans carte bancaire</li>
          <li>Fonctionne sans connexion</li>
        </ul>
      </section>

      {/* Colonne unique, sans encadré. La maquette de navigateur qui occupait la
          moitié droite était un faux écran dessiné en div : trois pastilles
          grises et du texte. Elle prétendait montrer le produit sans rien en
          montrer. Le ticket du hero, lui, est un vrai objet. */}
      <section className="container-page py-14 sm:py-20">
        <h2 className="max-w-3xl font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">
          Un logiciel de facturation ne connaît pas votre rayon.
        </h2>
        <p className="mt-5 max-w-[65ch] text-[#f3ece1]/65">
          Il sait éditer une facture. Il ne sait pas qu&apos;un carton contient douze
          bouteilles, que le prix du carton n&apos;est pas douze fois celui de la bouteille,
          ni que votre client repart avec trois bouteilles et un carton dans la même vente.
          MagyaPro est construit autour de ça.
        </p>

        <dl className="mt-12 grid gap-x-12 border-t border-white/10 sm:grid-cols-2">
          {[
            {
              term: 'Vos unités, pas les nôtres',
              detail: 'Carton, sac, bidon, rouleau, mètre, kilo, paire, avec un prix propre à chaque conditionnement. Le stock reste juste, quelle que soit la façon dont vous vendez.',
            },
            {
              term: 'La vente passe même sans réseau',
              detail: 'Vous encaissez hors connexion ; tout se synchronise au retour du signal. Une coupure n\'arrête pas votre journée.',
            },
            {
              term: 'Chaque vente compte',
              detail: 'La caisse décrémente le stock en temps réel. Jamais de vente enregistrée sans mouvement correspondant.',
            },
            {
              term: 'La même caisse sur tous vos écrans',
              detail: 'Téléphone, tablette ou ordinateur, rien à installer. Vous ouvrez MagyaPro dans votre navigateur et le stock reste le même partout.',
            },
            {
              term: 'Vos données vous appartiennent',
              detail: 'Votre catalogue, vos clients et votre chiffre d\'affaires restent isolés de ceux des autres boutiques.',
            },
          ].map((item, index, all) => (
            <div
              key={item.term}
              className={`border-b border-white/10 py-6 ${
                // Cinq entrées sur deux colonnes : la dernière traverse toute la
                // largeur plutôt que de laisser une demi-ligne vide à sa droite.
                index === all.length - 1 && all.length % 2 === 1 ? 'sm:col-span-2' : ''
              }`}
            >
              <dt className="font-display font-semibold text-[#f3ece1]">{item.term}</dt>
              <dd className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-[#f3ece1]/60">{item.detail}</dd>
            </div>
          ))}
        </dl>
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
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">Comment ça fonctionne</h2>
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
      {/* Douze cartes identiques mettaient sur le même plan ce qui distingue
          MagyaPro et ce que fait n'importe quel logiciel de caisse. Le lecteur
          survolait les douze et n'en retenait aucune. Trois éléments portent
          désormais l'argument, en pleine largeur ; les neuf autres, attendus
          mais nécessaires, sont regroupés par moment de la journée. */}
      <section id="fonctionnalites" className="container-page py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#e0bd52]">Fonctionnalités</span>
          <h2 className="mt-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">
            Trois choses qu&apos;un logiciel de caisse ordinaire ne fait pas
          </h2>
        </div>

        <div className="mt-12 grid gap-10 border-t border-white/10 pt-10 lg:grid-cols-3 lg:gap-0">
          {[
            {
              title: 'Le carton et la bouteille',
              detail:
                'Vous déclarez qu\'un carton contient douze bouteilles, puis vous saisissez les deux prix. Ils sont indépendants : le prix du carton n\'est jamais douze fois celui de la bouteille. En caisse, vous choisissez l\'un ou l\'autre et le stock reste juste.',
              icon: FEATURE_ICONS.stock,
            },
            {
              title: 'La caisse tient sans réseau',
              detail:
                'La vente est enregistrée sur l\'appareil et repart toute seule dès que le signal revient. Une coupure de connexion ne vous fait pas fermer la caisse ni ressortir le cahier.',
              icon: FEATURE_ICONS.pos,
            },
            {
              title: 'La rupture annoncée avant',
              detail:
                'MagyaPro mesure votre rythme de vente réel sur les semaines passées et en déduit la date de rupture de chaque produit. Vous commandez avant que le rayon soit vide, pas après.',
              icon: FEATURE_ICONS.reports,
            },
          ].map((item) => (
            <div key={item.title} className="lg:border-l lg:border-white/10 lg:px-8 lg:first:border-l-0 lg:first:pl-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e0bd52]/15 text-[#e0bd52]">
                {item.icon}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold tracking-[-0.01em] text-[#f3ece1]">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#f3ece1]/65">{item.detail}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-20 font-display text-xl font-bold tracking-[-0.01em] text-[#f3ece1]">
          Et tout ce qu&apos;une boutique attend d&apos;un logiciel
        </h3>
        <div className="mt-8 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              group: 'Vendre',
              items: [
                ['Caisse tactile', 'Scan code-barres par la caméra, remises, TVA, paiements multiples et fractionnés.'],
                ['Promotions', 'Codes promo en pourcentage ou en montant, avec dates et limites d\'usage.'],
                ['Clients & crédit', 'Fichier client, vente à crédit, historique des paiements.'],
              ],
            },
            {
              group: 'Tenir le stock',
              items: [
                ['Dates de péremption', 'Les produits proches de leur date passent en orange, les périmés en rouge, sans ouvrir une seule fiche.'],
                ['Achats & fournisseurs', 'Commandes, réceptions, coût d\'achat moyen, dettes fournisseurs.'],
                ['Analyses automatiques', 'Capital immobilisé, produits qui dorment, marges réelles, ventes à perte.'],
              ],
            },
            {
              group: 'Piloter',
              items: [
                ['Caisses & finances', 'Ouverture et fermeture de caisse, dépenses, bénéfice net.'],
                ['Multi-boutique', 'Plusieurs points de vente, vue consolidée pour les propriétaires.'],
                ['Double authentification', 'La connexion de votre équipe protégée par un code à usage unique.'],
              ],
            },
          ].map((cluster) => (
            <div key={cluster.group}>
              <h4 className="border-b border-white/10 pb-3 font-display text-sm font-semibold text-[#e0bd52]">
                {cluster.group}
              </h4>
              <dl className="mt-5 space-y-5">
                {cluster.items.map(([term, detail]) => (
                  <div key={term}>
                    <dt className="text-sm font-medium text-[#f3ece1]">{term}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#f3ece1]/55">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Secteurs */}
      <section id="secteurs" className="border-y border-white/10 bg-black/20">
        <div className="container-page py-16 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">
              Pensé pour votre activité
            </h2>
            <p className="mt-3 text-[#f3ece1]/60">
              Chaque secteur arrive avec ses unités de vente déjà en place : le mètre pour le
              tissu, la pointure pour la chaussure, le sac pour le ciment.
            </p>
          </div>
          {/* Vignettes serrées, sans encadré. La section « Comment ça fonctionne »
              utilise déjà la grille de quatre cartes à image ; répéter la même
              famille de mise en page ici donnerait deux fois le même écran. */}
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
            {BOUTIQUE_SECTORS.map((sector) => {
              const imageUrl = boutiqueSectorImageUrl(sector);
              return (
                <div key={sector} className="group">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- illustration de plateforme, hôte de stockage arbitraire
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div aria-hidden="true" className="h-full w-full bg-[#e0bd52]/15" />
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-[#f3ece1]">{SECTOR_LABELS[sector]}</h3>
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
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">
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
                    className="block w-full rounded-xl bg-[#e0bd52] px-3 py-2.5 text-center text-sm font-semibold text-[#1c1712] transition-colors hover:bg-[#eccb63] active:translate-y-px disabled:opacity-60"
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
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">Des tarifs lisibles</h2>
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
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">Questions fréquentes</h2>
        <div className="mt-10 max-w-3xl divide-y divide-white/10 border-y border-white/10">
          {[
            {
              q: 'Faut-il des connaissances techniques ?',
              a: 'Non. Vous configurez votre boutique depuis votre téléphone ou votre ordinateur, en quelques étapes guidées.',
            },
            {
              q: 'Combien de temps pour démarrer ?',
              a: 'Le temps de créer votre compte et vos premiers produits, généralement moins d\'une demi-heure.',
            },
            {
              q: 'Puis-je utiliser MagyaPro sur plusieurs appareils ?',
              a: 'Oui. Téléphone, tablette ou ordinateur : le catalogue, le stock et les ventes sont les mêmes partout, mis à jour au fur et à mesure.',
            },
            {
              q: 'Je vends au carton et à l’unité, avec des prix différents. C’est possible ?',
              a: 'C’est précisément ce pour quoi MagyaPro a été conçu. Vous déclarez qu’un carton contient 12 bouteilles, puis vous saisissez le prix du carton ET le prix de la bouteille. Ils sont indépendants : le prix du carton n’est jamais un simple calcul. En caisse, vous choisissez l’un ou l’autre ; le stock reste juste dans les deux cas.',
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
      {/* Le halo flou et le bouton en pilule dégradée ont disparu : c'était le
          seul bouton rond et le seul dégradé de la page, au moment précis où le
          visiteur doit reconnaître le même bouton qu'en haut. Il est maintenant
          identique à celui du hero, à la lettre près. */}
      <section className="border-t border-white/10 bg-[#1c1712]">
        <div className="container-page py-20 text-center sm:py-28">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#f3ece1] sm:text-4xl">
            Votre boutique, prête à vendre dès aujourd&apos;hui.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#f3ece1]/65">
            Créez votre compte, ajoutez vos produits, ouvrez la caisse. Vous pourrez tout
            modifier ensuite.
          </p>
          <div className="mt-9">
            <Link
              href="/boutique/inscription"
              className="inline-flex items-center justify-center rounded-xl bg-[#e0bd52] px-7 py-4 font-display text-sm font-semibold text-[#1c1712] transition-colors hover:bg-[#eccb63] active:translate-y-px"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
