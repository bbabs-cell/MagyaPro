import type { Metadata } from 'next';

import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: "Centre d'aide" };

type Entry = { q: string; a: string };
type Section = { title: string; entries: Entry[] };

const SECTIONS: Section[] = [
  {
    title: 'Démarrer',
    entries: [
      {
        q: 'Comment mettre mon site en ligne ?',
        a: 'Complétez votre menu (au moins une catégorie avec un plat), vos horaires et vos informations dans Réglages, puis passez votre statut sur « Publié » dans Réglages → Publication. Tant que le site n\'est pas publié, il reste invisible pour vos clients.',
      },
      {
        q: 'Puis-je changer de template plus tard ?',
        a: 'Oui, autant de fois que vous voulez, depuis Apparence. Changer de template ne touche jamais à votre menu, vos photos, vos commandes ni vos clients : seule l\'habillage visuel change.',
      },
      {
        q: "J'ai plusieurs restaurants, comment les gérer ?",
        a: 'Si votre compte est rattaché à plusieurs restaurants, un sélecteur apparaît en haut de la barre latérale pour passer de l\'un à l\'autre.',
      },
    ],
  },
  {
    title: 'Menu et commandes',
    entries: [
      {
        q: 'Comment marquer un plat comme épuisé ?',
        a: 'Depuis Menu, ouvrez le plat et désactivez-le en un geste — il disparaît immédiatement du site public sans être supprimé, vous pourrez le réactiver plus tard.',
      },
      {
        q: 'Comment fonctionnent les commandes ?',
        a: 'Une commande passe par les statuts Nouvelle → Confirmée → En préparation → Prête → (En livraison) → Livrée/Terminée. Chaque changement de statut peut notifier le client par WhatsApp (bouton manuel) et par SMS (si configuré).',
      },
      {
        q: 'Un plat a une option ou une variante, comment les ajouter ?',
        a: 'Sur la fiche du plat, dans Menu, ajoutez des variantes (ex. tailles) ou des groupes d\'options (ex. suppléments) — chacun avec son propre prix additionnel.',
      },
      {
        q: 'Comment fonctionne le suivi GPS des livraisons ?',
        a: 'Un livreur qui ouvre Mes livraisons partage sa position automatiquement tant qu\'une course lui est assignée (avec son autorisation navigateur). Le client la voit en direct sur sa page de suivi de commande.',
      },
    ],
  },
  {
    title: 'Abonnement et paiement',
    entries: [
      {
        q: 'Comment payer mon abonnement ?',
        a: 'Depuis Abonnement, choisissez un plan et un moyen de paiement (Wave ou Orange Money). Vous envoyez le montant au numéro indiqué, déposez une preuve, et le nouveau plan s\'active dès validation par Magyapro.',
      },
      {
        q: 'Que se passe-t-il si je ne renouvelle pas à temps ?',
        a: 'Vous recevez une alerte 5 jours avant l\'échéance. Passé le délai, un délai de grâce de 3 jours s\'ouvre. S\'il expire sans renouvellement, votre compte bascule automatiquement sur le plan le plus accessible plutôt que d\'être suspendu.',
      },
      {
        q: 'Où trouver mes reçus de paiement ?',
        a: 'Dans Abonnement, la section Historique des paiements donne accès à un reçu imprimable ou exportable en PDF pour chaque paiement validé. Idem pour chaque commande depuis sa page de détail.',
      },
    ],
  },
  {
    title: 'Équipe et permissions',
    entries: [
      {
        q: 'Comment donner accès à un employé sans lui montrer mes revenus ?',
        a: 'Depuis Équipe, invitez-le avec un rôle limité (ex. Cuisine, Livreur) : il ne voit que ce que son rôle autorise — jamais les statistiques ni les paramètres sensibles, sauf si vous les lui accordez explicitement.',
      },
      {
        q: 'Comment retracer qui a fait quoi ?',
        a: 'Le Journal (dans Compte) conserve un historique horodaté des actions sensibles de votre équipe.',
      },
    ],
  },
  {
    title: 'Réglages avancés',
    entries: [
      {
        q: 'Comment activer la TVA sur mes reçus ?',
        a: 'Dans Réglages → Avancé, activez la TVA et indiquez votre taux. Les prix affichés à vos clients ne changent pas : le taux sert uniquement à faire apparaître la part de TVA déjà comprise, sur vos reçus.',
      },
      {
        q: 'Comment suivre mes visiteurs avec Google Analytics ou Meta Pixel ?',
        a: 'Toujours dans Réglages → Avancé, renseignez vos propres identifiants GA4 et/ou Meta Pixel. Magyapro ne collecte rien pour vous : ce sont vos identifiants, sur votre site.',
      },
      {
        q: 'Comment récupérer toutes mes données ?',
        a: 'Réglages → Sauvegarde propose un export complet au format JSON (menu, commandes, clients, réglages) — utile en secours ou pour repartir ailleurs.',
      },
    ],
  },
  {
    title: 'Mode sombre',
    entries: [
      {
        q: 'Où activer le mode sombre ?',
        a: 'Un bouton (icône soleil/lune) est disponible en bas de la barre latérale du tableau de bord, et dans l\'en-tête sur mobile. Le choix est mémorisé sur cet appareil.',
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="Centre d'aide"
        description="Les réponses aux questions les plus courantes sur Magyapro."
      />

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {section.title}
            </h2>
            <div className="mt-3 divide-y divide-surface-border border-y border-surface-border">
              {section.entries.map((entry) => (
                <details key={entry.q} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
                    {entry.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-ink-muted">{entry.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Une question sans réponse ici ? Contactez le support Magyapro depuis votre espace Super Admin, ou par email si vous en avez un configuré.
      </p>
    </>
  );
}
