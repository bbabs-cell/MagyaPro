import Link from 'next/link';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { howItWorksImageUrl, platformLogoUrl, templatePreviewUrl } from '@/lib/storage';
import { getActivePromo } from '@/lib/platform-settings';
import { Logo } from '@/components/ui/logo';
import { PlanGrid } from '@/components/marketing/plan-grid';
import { Ticket } from '@/components/marketing/ticket';
import { PromoBanner } from '@/components/marketing/promo-banner';

/**
 * Landing page.
 *
 * Les tarifs, les templates et les démonstrations sont lus en base : ce que
 * voit un visiteur correspond à ce que la plateforme propose réellement. Un
 * changement de prix en administration se reflète ici sans redéploiement.
 */

export const revalidate = 300;

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

/** Les trois traits distinctifs. Traits simples, cohérents avec le reste de la marque. */
const FEATURE_ICONS: Record<string, React.ReactElement> = {
  menu: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  orders: (
    <svg {...ICON_PROPS}>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  delivery: (
    <svg {...ICON_PROPS}>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </svg>
  ),
};

export default async function LandingPage() {
  const [plans, templates, demos, promo] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true, product: 'RESTAURANT' },
      orderBy: { position: 'asc' },
    }),
    prisma.template.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }),
    prisma.restaurant.findMany({
      where: { isDemo: true, status: 'ACTIVE' },
      select: { name: true, slug: true, description: true, primaryColor: true },
      take: 3,
    }),
    getActivePromo(),
  ]);

  const heroLogoUrl = platformLogoUrl();

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-surface-border bg-[#0b1730]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="container-page relative py-20 sm:py-24 lg:py-28">
          {/* Même structure que la page Boutique : la promesse à gauche, la
              preuve imprimée à droite. C'est la parenté de marque — un seul
              geste montré des deux côtés, pas une illustration recopiée. */}
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
            <div className="fade-in-up max-w-2xl">
              <div className="flex items-center gap-3">
                <Logo src={heroLogoUrl} showText={false} className="h-10 w-10" />
                <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#ff9a4d]">
                  MagyaPro Restaurant
                </span>
              </div>

              {/* « la salle » en police de bon de commande, comme « carton »
                  côté Boutique : chaque produit met en avant l'unité de son
                  métier, dans la même typographie. */}
              <h1 className="mt-8 font-display text-[2.75rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.25rem]">
                De la commande
                <span className="mt-1 block font-mono text-[2.25rem] font-medium tracking-[-0.01em] text-[#ff9a4d] sm:text-5xl lg:text-[3.5rem]">
                  à la cuisine
                </span>
                sans un papier perdu.
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                Le client commande depuis sa table ou votre site. Le bon part en cuisine, la
                salle suit, la caisse compte.
              </p>

              {/* Un bouton principal, un secondaire. Le troisième lien vers une
                  démonstration a rejoint la section « Voir MagyaPro en
                  situation » plus bas : trois appels à l'action côte à côte, le
                  visiteur n'en choisit aucun. */}
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/inscription"
                  className="inline-flex items-center justify-center rounded-xl bg-[#ff5e2e] px-7 py-4 font-display text-sm font-semibold text-white transition-colors hover:bg-[#ff7145] active:translate-y-px"
                >
                  Commencer gratuitement
                </Link>
                <Link
                  href="#fonctionnement"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 px-7 py-4 font-display text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  Voir comment ça marche
                </Link>
              </div>

              {promo && (
                <div className="mt-6">
                  <PromoBanner
                    discountPercent={promo.discountPercent}
                    endsAt={promo.endsAt}
                    label={promo.label}
                  />
                </div>
              )}
            </div>

            {/* Le bon de cuisine — l'objet que ce produit fabrique vraiment.
                Il ne totalise pas de l'argent mais du travail à faire :
                c'est ce qui le distingue du ticket de caisse côté Boutique. */}
            <div className="justify-self-center lg:justify-self-end">
              <Ticket
                tone="blanc"
                header="Le Maquis d'Or"
                meta="Bon n°34 · Table 7 · 19:42"
                lines={[
                  { kind: 'item', label: 'Poulet braisé', detail: '2 ×, bien cuit' },
                  { kind: 'item', label: 'Attiéké poisson', detail: '1 ×' },
                  { kind: 'item', label: 'Bissap maison', detail: '3 ×' },
                  { kind: 'rule' },
                  { kind: 'total', label: 'Reçu à', amount: '19:42' },
                  { kind: 'item', label: 'En cuisine depuis', amount: '4 min' },
                  { kind: 'rule' },
                  { kind: 'note', text: 'Salle prévenue dès que c’est prêt' },
                ]}
                footer="À préparer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Présentation */}
      {/* Les trois assurances qui figuraient sous les boutons du hero. */}
      <section className="container-page pt-12">
        <ul className="flex flex-wrap gap-x-8 gap-y-2 border-y border-surface-border py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          <li>1 mois gratuit</li>
          <li>Sans carte bancaire</li>
          <li>Votre site en ligne le jour même</li>
        </ul>
      </section>

      {/* Colonne unique, sans encadré. La fausse fenêtre de navigateur qui
          occupait la moitié droite (trois pastilles grises et du texte) faisait
          semblant de montrer le produit. L'adresse qu'elle contenait est une
          information réelle : elle rejoint la liste ci-dessous. */}
      <section className="container-page py-14 sm:py-20">
        <h2 className="max-w-3xl font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
          Votre restaurant mérite mieux qu&apos;une page de réseau social.
        </h2>
        <p className="mt-5 max-w-[65ch] text-ink-muted">
          Vos clients cherchent votre menu, vos horaires et un moyen simple de commander.
          MagyaPro réunit tout cela sur une adresse qui vous appartient, tenue à jour depuis
          votre téléphone.
        </p>

        <dl className="mt-12 grid gap-x-12 border-t border-surface-border sm:grid-cols-2">
          {[
            {
              term: 'Une adresse à vous',
              detail: `Chaque restaurant reçoit la sienne dès la création, du type chez-fatou.${env.rootDomain.split(':')[0]}. Vous pourrez y associer votre propre nom de domaine si vous en possédez un.`,
            },
            {
              term: 'Aucune compétence technique',
              detail:
                'Vous remplissez des formulaires, MagyaPro construit le site. Pas de code, pas d\'hébergement à gérer.',
            },
            {
              term: 'Modifiable à tout moment',
              detail:
                'Un plat épuisé, un prix qui change, un horaire exceptionnel : la modification est visible immédiatement.',
            },
            {
              term: 'Vos données vous appartiennent',
              detail:
                'Vos clients, vos commandes et votre chiffre d\'affaires restent les vôtres, isolés de ceux des autres restaurants.',
            },
          ].map((item) => (
            <div key={item.term} className="border-b border-surface-border py-6">
              <dt className="font-display font-semibold text-ink">{item.term}</dt>
              <dd className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-ink-muted">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------------- Fonctionnement */}
      {/* Bande sombre à part entière : cette section a sa propre identité
          visuelle plutôt que de se fondre dans le rythme clair/gris des
          sections voisines — elle mérite d'être remarquée en un coup d'œil. */}
      <section id="fonctionnement" className="relative overflow-hidden bg-[#0b1730]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="container-page relative py-16 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-4xl">
              Comment ça fonctionne
            </h2>
            <p className="mt-3 text-white/60">
              Quatre étapes, guidées de bout en bout.
            </p>
          </div>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: 1 as const, title: 'Créez votre compte', detail: 'Nom, email, mot de passe. Rien de plus.' },
              { step: 2 as const, title: 'Décrivez votre restaurant', detail: 'Logo, adresse, horaires, réseaux sociaux.' },
              { step: 3 as const, title: 'Composez votre menu', detail: 'Catégories, plats, photos, prix et options.' },
              { step: 4 as const, title: 'Publiez', detail: 'Votre site est en ligne et prêt à recevoir des commandes.' },
            ].map((item) => {
              const imageUrl = howItWorksImageUrl(item.step);
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
                      <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-[#2f5bd8]/60 to-[#ff5e2e]/40" />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
                    />
                    <span className="absolute bottom-3 left-4 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] text-sm font-bold text-white shadow-lg">
                      {item.step}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/55">{item.detail}</p>
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
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand">
            Fonctionnalités
          </span>
          <h2 className="mt-3 font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            Trois choses qu&apos;une page de réseau social ne fait pas
          </h2>
        </div>

        {/* Neuf cartes identiques mettaient le fichier client au même niveau
            que le passage de la commande en cuisine. Trois éléments portent
            l'argument, les six autres suivent, groupés par moment du service. */}
        <div className="mt-12 grid gap-10 border-t border-surface-border pt-10 lg:grid-cols-3 lg:gap-0">
          {[
            {
              title: 'De la table à la cuisine',
              detail:
                'Le client commande depuis son téléphone, le bon arrive en cuisine et la salle voit où en est chaque table. Personne ne recopie une commande sur un carnet, personne ne perd un papier.',
              icon: FEATURE_ICONS.orders,
            },
            {
              title: 'Le menu change dans la minute',
              detail:
                'Un plat épuisé se marque en un geste depuis votre téléphone et disparaît aussitôt du site. Vous ne prenez plus de commandes pour un plat que vous ne pouvez pas servir.',
              icon: FEATURE_ICONS.menu,
            },
            {
              title: 'Vos zones de livraison',
              detail:
                'Un tarif par quartier, un minimum de commande, la livraison offerte au-delà d\'un montant. Le client voit le coût réel avant de valider, pas au moment où le livreur sonne.',
              icon: FEATURE_ICONS.delivery,
            },
          ].map((item) => (
            <div key={item.title} className="lg:border-l lg:border-surface-border lg:px-8 lg:first:border-l-0 lg:first:pl-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {item.icon}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold tracking-[-0.01em] text-ink">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{item.detail}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-20 font-display text-xl font-bold tracking-[-0.01em] text-ink">
          Et tout ce qu&apos;un restaurant attend d&apos;un logiciel
        </h3>
        <div className="mt-8 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {[
            {
              group: 'Pendant le service',
              items: [
                ['Fichier client', 'Chaque commande enrichit votre fichier : coordonnées, historique, montant dépensé.'],
                ['Codes promo', 'Remise en pourcentage ou en montant, avec dates de validité et limite d\'utilisation.'],
                ['Plusieurs comptes', 'Un accès limité pour votre équipe : le service voit les commandes, pas vos revenus.'],
              ],
            },
            {
              group: 'Après le service',
              items: [
                ['Statistiques', 'Chiffre d\'affaires, panier moyen, plats populaires, périodes d\'activité.'],
                ['Paiements', 'Paiement à la livraison et sur place dès aujourd\'hui, mobile money à mesure des intégrations.'],
                ['Site optimisé', 'Rapide sur connexion mobile, référencé, installable comme une application.'],
              ],
            },
          ].map((cluster) => (
            <div key={cluster.group}>
              <h4 className="border-b border-surface-border pb-3 font-display text-sm font-semibold text-brand">
                {cluster.group}
              </h4>
              <dl className="mt-5 space-y-5">
                {cluster.items.map(([term, detail]) => (
                  <div key={term}>
                    <dt className="text-sm font-medium text-ink">{term}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Templates */}
      {templates.length > 0 && (
        <section id="templates" className="border-y border-surface-border bg-surface-sunken">
          <div className="container-page py-16 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
                Des templates pour chaque style de maison
              </h2>
              <p className="mt-3 text-ink-muted">
                Changez de template quand vous voulez : votre menu, vos photos et
                vos commandes restent intacts.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const previewUrl = templatePreviewUrl(template.key);
                return (
                <div
                  key={template.id}
                  className="hover-glow group overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-sm transition-all hover:-translate-y-1"
                >
                  <div className="relative h-44 overflow-hidden">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- aperçu de template, hôte de stockage arbitraire
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-full w-full bg-gradient-to-br from-[#0b1730] to-[#2f5bd8]"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-ink">{template.name}</h3>
                    {template.description && (
                      <p className="mt-1.5 text-sm text-ink-muted">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Démonstrations */}
      {demos.length > 0 && (
        <section className="container-page py-16 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
              Voir Magyapro en situation
            </h2>
            <p className="mt-3 text-ink-muted">
              Ces restaurants sont des exemples créés pour la démonstration. Ils
              fonctionnent exactement comme le vôtre fonctionnera.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {demos.map((demo) => (
              <Link
                key={demo.slug}
                href={`/r/${demo.slug}`}
                className="hover-glow group rounded-2xl border border-surface-border bg-surface p-6 transition-all hover:-translate-y-1"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-10 w-10 rounded-xl shadow-sm"
                  style={{ backgroundColor: demo.primaryColor }}
                />
                <h3 className="mt-4 font-semibold text-ink">{demo.name}</h3>
                {demo.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                    {demo.description}
                  </p>
                )}
                <p className="mt-3 flex items-center gap-1 text-sm font-medium text-brand">
                  Voir le site
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Tarifs */}
      <section id="tarifs" className="border-y border-surface-border bg-surface-sunken">
        <div className="container-page py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
                Des tarifs lisibles
              </h2>
              <p className="mt-3 text-ink-muted">
                Chaque plan démarre par une période d&apos;essai. Sans engagement.
              </p>
            </div>
            <Link
              href="/restaurant/tarifs"
              className="text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              Voir tous les détails →
            </Link>
          </div>

          {promo && (
            <div className="mt-6">
              <PromoBanner
                discountPercent={promo.discountPercent}
                endsAt={promo.endsAt}
                label={promo.label}
              />
            </div>
          )}

          <PlanGrid plans={plans} />
        </div>
      </section>

      {/* ------------------------------------------------------------------- FAQ */}
      <section id="faq" className="container-page py-16 sm:py-24">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
          Questions fréquentes
        </h2>
        <div className="mt-10 max-w-3xl divide-y divide-surface-border border-y border-surface-border">
          {[
            {
              q: 'Faut-il des connaissances techniques ?',
              a: "Non. Vous remplissez des formulaires depuis votre téléphone ou votre ordinateur, et Magyapro construit le site. Aucun hébergement ni nom de domaine à acheter pour démarrer.",
            },
            {
              q: 'Combien de temps pour être en ligne ?',
              a: "Le temps de saisir vos informations et vos premiers plats, généralement moins d'une demi-heure. Vous pouvez publier avec quelques plats et compléter le menu ensuite.",
            },
            {
              q: 'Puis-je utiliser mon propre nom de domaine ?',
              a: "Oui, sur les plans qui incluent cette option. Vous ajoutez votre domaine, Magyapro vous indique l'enregistrement DNS à créer, puis vérifie la configuration.",
            },
            {
              q: 'Comment mes clients paient-ils ?',
              a: "Le paiement à la livraison et le paiement sur place sont disponibles immédiatement. Les paiements mobile money s'ajoutent au fur et à mesure des intégrations ; ils n'apparaissent dans votre tunnel de commande qu'une fois réellement opérationnels.",
            },
            {
              q: 'Puis-je changer de template plus tard ?',
              a: "Oui, autant de fois que vous le souhaitez. Le template ne fait que présenter vos données : votre menu, vos photos, vos commandes et vos clients ne sont jamais affectés.",
            },
            {
              q: 'Mes données sont-elles isolées des autres restaurants ?',
              a: "Oui. Chaque restaurant constitue un espace indépendant. Aucun restaurant ne peut consulter les commandes, les clients ou les statistiques d'un autre.",
            },
          ].map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- CTA final */}
      {/* Halo flou et bouton en pilule dégradée retirés : c'était le seul bouton
          rond et le seul dégradé de la page, à l'endroit exact où le visiteur
          doit reconnaître le bouton qu'il a déjà vu en haut. */}
      <section className="border-t border-surface-border bg-[#0b1730]">
        <div className="container-page py-20 text-center sm:py-28">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-4xl">
            Votre restaurant en ligne dès aujourd&apos;hui.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Créez votre compte, composez votre menu, publiez. Vous pourrez tout
            modifier ensuite.
          </p>
          <div className="mt-9">
            <Link
              href="/inscription"
              className="inline-flex items-center justify-center rounded-xl bg-[#ff5e2e] px-7 py-4 font-display text-sm font-semibold text-white transition-colors hover:bg-[#ff7145] active:translate-y-px"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
