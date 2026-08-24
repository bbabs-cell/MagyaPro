import Link from 'next/link';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { howItWorksImageUrl, platformLogoUrl, templatePreviewUrl } from '@/lib/storage';
import { getActivePromo } from '@/lib/platform-settings';
import { Logo } from '@/components/ui/logo';
import { PlanGrid } from '@/components/marketing/plan-grid';
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

/** Icônes de la grille de fonctionnalités — traits simples, cohérents avec le reste de la marque. */
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
  customers: (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  ),
  stats: (
    <svg {...ICON_PROPS}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  ),
  promo: (
    <svg {...ICON_PROPS}>
      <path d="M20 12 12.5 19.5a2 2 0 0 1-2.8 0L4 13.8a2 2 0 0 1 0-2.8L11.5 3.5H18a2 2 0 0 1 2 2V12Z" />
      <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  payments: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  ),
  speed: (
    <svg {...ICON_PROPS}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  ),
  team: (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M14.5 20a4.5 4.5 0 0 1 7-3.6" />
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-[#2f5bd8] opacity-40 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-[#ff5e2e] opacity-30 blur-[110px]"
        />

        <div className="container-page relative py-20 sm:py-28 lg:py-32">
          <div className="fade-in-up mx-auto max-w-3xl text-center">
            <Logo
              src={heroLogoUrl}
              showText={false}
              className="mx-auto h-14 w-14 drop-shadow-[0_0_24px_rgba(255,94,46,0.35)] sm:h-16 sm:w-16"
            />
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-white/80 backdrop-blur">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#ff5e2e]" />
              Plateforme pour restaurateurs
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Créez votre restaurant{' '}
              <span className="bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] bg-clip-text text-transparent">
                en ligne
              </span>{' '}
              simplement.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
              Magyapro vous permet de créer rapidement un site professionnel pour
              votre restaurant, présenter votre menu, recevoir des commandes et
              développer votre présence digitale.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/inscription"
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] px-8 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(255,94,46,0.6)] transition-transform hover:scale-[1.03] sm:w-auto"
              >
                Commencer gratuitement
              </Link>
              <Link
                href="#fonctionnement"
                className="inline-flex h-14 w-full items-center justify-center rounded-full border border-white/20 px-8 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Découvrir Magyapro
              </Link>
              {demos.length > 0 && (
                <Link
                  href={`/r/${demos[0]!.slug}`}
                  className="inline-flex h-14 w-full items-center justify-center rounded-full px-8 text-sm font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-white sm:w-auto"
                >
                  Voir une démo
                </Link>
              )}
            </div>
            <p className="mt-5 text-xs text-white/50">
              Sans carte bancaire · Sans engagement · Votre site en ligne en quelques minutes
            </p>
            {promo && (
              <div className="mt-5">
                <PromoBanner
                  discountPercent={promo.discountPercent}
                  endsAt={promo.endsAt}
                  label={promo.label}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Présentation */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Votre restaurant mérite mieux qu&apos;une page de réseau social.
            </h2>
            <p className="mt-4 text-ink-muted">
              Vos clients cherchent votre menu, vos horaires et un moyen simple
              de commander. Magyapro réunit tout cela sur une adresse qui vous
              appartient, tenue à jour depuis votre téléphone.
            </p>
            <dl className="mt-8 space-y-5">
              {[
                {
                  term: 'Aucune compétence technique',
                  detail:
                    'Vous remplissez des formulaires, Magyapro construit le site. Pas de code, pas d\'hébergement à gérer.',
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
                <div key={item.term} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                  />
                  <div>
                    <dt className="font-medium text-ink">{item.term}</dt>
                    <dd className="mt-0.5 text-sm text-ink-muted">{item.detail}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-2xl border border-surface-border bg-[#0b1730] shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-medium uppercase tracking-wide text-white/40">
                Votre adresse
              </p>
              <p className="mt-2 break-all font-mono text-lg text-white">
                chez-fatou.
                <span className="bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] bg-clip-text text-transparent">
                  {env.rootDomain.split(':')[0]}
                </span>
              </p>
              <p className="mt-3 text-sm text-white/60">
                Chaque restaurant reçoit sa propre adresse dès la création. Vous
                pourrez y associer votre nom de domaine si vous en possédez un.
              </p>
            </div>
          </div>
        </div>
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
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff9a4d]">
              Le parcours
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
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
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
            Fonctionnalités
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
            Tout ce qu&apos;il faut pour vendre en ligne
          </h2>
          <p className="mt-3 text-ink-muted">
            Pensé pour la réalité d&apos;un service : rapide sur mobile, lisible en cuisine.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Menu digital', detail: 'Catégories, plats, photos, variantes et suppléments. Marquez un plat épuisé en un geste.', icon: FEATURE_ICONS.menu },
            { title: 'Commandes en ligne', detail: 'Panier, livraison ou retrait, suivi du statut de la réception à la remise.', icon: FEATURE_ICONS.orders },
            { title: 'Zones de livraison', detail: 'Des tarifs par zone, un minimum de commande, la livraison offerte au-delà d\'un montant.', icon: FEATURE_ICONS.delivery },
            { title: 'Fichier client', detail: 'Chaque commande enrichit votre fichier : coordonnées, historique, montant dépensé.', icon: FEATURE_ICONS.customers },
            { title: 'Statistiques', detail: 'Chiffre d\'affaires, panier moyen, plats populaires, périodes d\'activité.', icon: FEATURE_ICONS.stats },
            { title: 'Codes promo', detail: 'Remise en pourcentage ou en montant, avec dates de validité et limite d\'utilisation.', icon: FEATURE_ICONS.promo },
            { title: 'Paiements', detail: 'Paiement à la livraison et sur place dès aujourd\'hui, mobile money à mesure des intégrations.', icon: FEATURE_ICONS.payments },
            { title: 'Site optimisé', detail: 'Rapide sur connexion mobile, référencé, installable comme une application.', icon: FEATURE_ICONS.speed },
            { title: 'Plusieurs comptes', detail: 'Donnez un accès limité à votre équipe : le service voit les commandes, pas vos revenus.', icon: FEATURE_ICONS.team },
          ].map((feature) => (
            <div
              key={feature.title}
              className="hover-glow group rounded-2xl border border-surface-border bg-surface p-6 transition-all hover:-translate-y-1 hover:border-transparent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {feature.icon}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{feature.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Templates */}
      {templates.length > 0 && (
        <section id="templates" className="border-y border-surface-border bg-surface-sunken">
          <div className="container-page py-16 sm:py-24">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
                Templates
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
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
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
              Exemples
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
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
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
                Tarifs
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
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
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          Questions
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
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
              a: "Le temps de saisir vos informations et vos premiers plats — généralement moins d'une demi-heure. Vous pouvez publier avec quelques plats et compléter le menu ensuite.",
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
      <section className="relative overflow-hidden border-t border-surface-border bg-[#0b1730]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[#ff5e2e] opacity-20 blur-[110px]"
        />
        <div className="container-page relative py-20 text-center sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Votre restaurant en ligne dès aujourd&apos;hui.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Créez votre compte, composez votre menu, publiez. Vous pourrez tout
            modifier ensuite.
          </p>
          <div className="mt-9">
            <Link
              href="/inscription"
              className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] px-9 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(255,94,46,0.6)] transition-transform hover:scale-[1.03]"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
