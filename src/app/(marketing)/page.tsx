import Link from 'next/link';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';
import { FEATURE_LABELS, LIMIT_LABELS, type Feature, type PlanLimits } from '@/lib/entitlements';
import { Badge, LinkButton } from '@/components/ui';

/**
 * Landing page.
 *
 * Les tarifs, les templates et les démonstrations sont lus en base : ce que
 * voit un visiteur correspond à ce que la plateforme propose réellement. Un
 * changement de prix en administration se reflète ici sans redéploiement.
 */

export const revalidate = 300;

export default async function LandingPage() {
  const [plans, templates, demos] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
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
  ]);

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-surface-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,#fdecea_0%,transparent_70%)]"
        />
        <div className="container-page relative py-16 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="brand">Plateforme pour restaurateurs</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Créez votre restaurant en ligne simplement.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-ink-muted sm:text-lg">
              Magyapro vous permet de créer rapidement un site professionnel pour
              votre restaurant, présenter votre menu, recevoir des commandes et
              développer votre présence digitale.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <LinkButton href="/inscription" size="lg" className="w-full sm:w-auto">
                Commencer gratuitement
              </LinkButton>
              <LinkButton
                href="#fonctionnement"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                Découvrir Magyapro
              </LinkButton>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Sans carte bancaire · Votre site en ligne en quelques minutes
            </p>
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

          <div className="rounded-2xl border border-surface-border bg-surface-sunken p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Votre adresse
            </p>
            <p className="mt-2 break-all font-mono text-lg text-ink">
              chez-fatou.<span className="text-brand">{env.rootDomain.split(':')[0]}</span>
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Chaque restaurant reçoit sa propre adresse dès la création. Vous
              pourrez y associer votre nom de domaine si vous en possédez un.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Fonctionnement */}
      <section id="fonctionnement" className="border-y border-surface-border bg-surface-sunken">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Comment ça fonctionne
            </h2>
            <p className="mt-3 text-ink-muted">
              Quatre étapes, guidées de bout en bout.
            </p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '1', title: 'Créez votre compte', detail: 'Nom, email, mot de passe. Rien de plus.' },
              { step: '2', title: 'Décrivez votre restaurant', detail: 'Logo, adresse, horaires, réseaux sociaux.' },
              { step: '3', title: 'Composez votre menu', detail: 'Catégories, plats, photos, prix et options.' },
              { step: '4', title: 'Publiez', detail: 'Votre site est en ligne et prêt à recevoir des commandes.' },
            ].map((item) => (
              <li key={item.step} className="card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-white">
                  {item.step}
                </span>
                <h3 className="mt-4 font-medium text-ink">{item.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- Fonctionnalités */}
      <section id="fonctionnalites" className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Tout ce qu&apos;il faut pour vendre en ligne
          </h2>
          <p className="mt-3 text-ink-muted">
            Pensé pour la réalité d&apos;un service : rapide sur mobile, lisible en cuisine.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Menu digital', detail: 'Catégories, plats, photos, variantes et suppléments. Marquez un plat épuisé en un geste.' },
            { title: 'Commandes en ligne', detail: 'Panier, livraison ou retrait, suivi du statut de la réception à la remise.' },
            { title: 'Zones de livraison', detail: 'Des tarifs par zone, un minimum de commande, la livraison offerte au-delà d\'un montant.' },
            { title: 'Fichier client', detail: 'Chaque commande enrichit votre fichier : coordonnées, historique, montant dépensé.' },
            { title: 'Statistiques', detail: 'Chiffre d\'affaires, panier moyen, plats populaires, périodes d\'activité.' },
            { title: 'Codes promo', detail: 'Remise en pourcentage ou en montant, avec dates de validité et limite d\'utilisation.' },
            { title: 'Paiements', detail: 'Paiement à la livraison et sur place dès aujourd\'hui, mobile money à mesure des intégrations.' },
            { title: 'Site optimisé', detail: 'Rapide sur connexion mobile, référencé, installable comme une application.' },
            { title: 'Plusieurs comptes', detail: 'Donnez un accès limité à votre équipe : le service voit les commandes, pas vos revenus.' },
          ].map((feature) => (
            <div key={feature.title} className="card p-5">
              <h3 className="font-medium text-ink">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{feature.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Templates */}
      {templates.length > 0 && (
        <section id="templates" className="border-y border-surface-border bg-surface-sunken">
          <div className="container-page py-16 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Des templates pour chaque style de maison
              </h2>
              <p className="mt-3 text-ink-muted">
                Changez de template quand vous voulez : votre menu, vos photos et
                vos commandes restent intacts.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <div key={template.id} className="card overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="h-32 bg-gradient-to-br from-ink/90 to-ink/60"
                  />
                  <div className="p-5">
                    <h3 className="font-medium text-ink">{template.name}</h3>
                    {template.description && (
                      <p className="mt-1.5 text-sm text-ink-muted">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Démonstrations */}
      {demos.length > 0 && (
        <section className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Voir Magyapro en situation
            </h2>
            <p className="mt-3 text-ink-muted">
              Ces restaurants sont des exemples créés pour la démonstration. Ils
              fonctionnent exactement comme le vôtre fonctionnera.
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {demos.map((demo) => (
              <Link
                key={demo.slug}
                href={`/r/${demo.slug}`}
                className="card p-5 transition-colors hover:border-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-8 w-8 rounded-lg"
                  style={{ backgroundColor: demo.primaryColor }}
                />
                <h3 className="mt-3 font-medium text-ink">{demo.name}</h3>
                {demo.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                    {demo.description}
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-brand">
                  Voir le site →
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Tarifs */}
      <section id="tarifs" className="border-y border-surface-border bg-surface-sunken">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Des tarifs lisibles
            </h2>
            <p className="mt-3 text-ink-muted">
              Chaque plan démarre par une période d&apos;essai. Sans engagement.
            </p>
          </div>

          {plans.length === 0 ? (
            <p className="mt-8 text-sm text-ink-muted">
              Les offres sont en cours de préparation. Créez votre compte, nous
              vous informerons dès leur ouverture.
            </p>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {plans.map((plan, index) => {
                const limits = (plan.limits ?? {}) as PlanLimits;
                const highlighted = index === 1;
                return (
                  <div
                    key={plan.id}
                    className={
                      highlighted
                        ? 'card relative border-ink p-6 shadow-sm'
                        : 'card p-6'
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
                      href="/inscription"
                      variant={highlighted ? 'primary' : 'secondary'}
                      className="mt-6 w-full"
                    >
                      Choisir {plan.name}
                    </LinkButton>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------- FAQ */}
      <section id="faq" className="container-page py-16 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Questions fréquentes
        </h2>
        <div className="mt-8 max-w-3xl divide-y divide-surface-border border-y border-surface-border">
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
      <section className="border-t border-surface-border bg-ink">
        <div className="container-page py-16 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Votre restaurant en ligne dès aujourd&apos;hui.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Créez votre compte, composez votre menu, publiez. Vous pourrez tout
            modifier ensuite.
          </p>
          <div className="mt-8">
            <Link
              href="/inscription"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-8 font-medium text-ink transition-colors hover:bg-white/90"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
