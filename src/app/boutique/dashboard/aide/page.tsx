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
        q: 'Comment mettre ma boutique en ligne ?',
        a: 'Ajoutez au moins un produit actif, complétez vos informations dans Réglages, puis passez le statut de votre boutique sur « Publiée » depuis Réglages → Publication. Tant qu\'elle n\'est pas publiée, votre boutique reste invisible pour vos clients.',
      },
      {
        q: 'Puis-je changer de template plus tard ?',
        a: 'Oui, autant de fois que vous voulez, depuis Apparence. Changer de template ne touche jamais à votre catalogue, vos ventes ni vos clients : seul l\'habillage visuel change.',
      },
      {
        q: "J'ai plusieurs boutiques, comment les gérer ?",
        a: 'Si votre compte est rattaché à plusieurs boutiques, un sélecteur apparaît en haut de la barre latérale pour passer de l\'une à l\'autre.',
      },
    ],
  },
  {
    title: 'Produits et stock',
    entries: [
      {
        q: 'Comment vendre un produit à la fois à l\'unité et par carton ?',
        a: 'Sur la fiche produit, renseignez la section « Vente par carton » : nombre d\'unités par carton, coût et prix du carton. La caisse propose alors les deux modes de vente, et le stock (toujours compté à l\'unité) se déduit automatiquement selon le mode choisi.',
      },
      {
        q: 'Comment suivre mon stock par entrepôt ?',
        a: 'Depuis Produits, chaque variante affiche sa quantité par entrepôt. Les transferts entre entrepôts et les mouvements de stock (vente, achat, ajustement, retour) sont journalisés automatiquement.',
      },
      {
        q: 'Comment être alerté d\'une rupture de stock ?',
        a: 'Définissez un « Seuil d\'alerte stock bas » sur chaque produit. Une notification sonore et visible se déclenche dès que le stock disponible passe sous ce seuil.',
      },
      {
        q: 'Comment importer mon catalogue en masse ?',
        a: 'Depuis Produits, utilisez Importer/Exporter pour charger un fichier Excel — utile pour démarrer avec un catalogue déjà existant.',
      },
    ],
  },
  {
    title: 'Caisse et ventes',
    entries: [
      {
        q: 'Comment encaisser une vente ?',
        a: 'Depuis Caisse, recherchez ou scannez un produit pour l\'ajouter au panier, choisissez le ou les moyens de paiement, puis validez. Un reçu est généré automatiquement.',
      },
      {
        q: 'Puis-je vendre sans connexion internet ?',
        a: 'Oui — si le réseau est coupé au moment d\'encaisser, la vente est mise en attente localement et envoyée automatiquement dès le retour de la connexion.',
      },
      {
        q: 'Comment fonctionne le crédit client ?',
        a: 'Si le paiement ne couvre pas la totalité et qu\'un client est sélectionné, le reste est mis à son crédit (dans la limite éventuellement fixée sur sa fiche). Il pourra régler ce solde plus tard.',
      },
      {
        q: 'Comment ouvrir et fermer une session de caisse ?',
        a: 'La barre en haut de la Caisse permet d\'ouvrir une session (fond de caisse) en début de journée et de la clôturer en fin de service, avec un rapprochement automatique des ventes en espèces.',
      },
    ],
  },
  {
    title: 'Achats et fournisseurs',
    entries: [
      {
        q: 'Comment enregistrer une commande fournisseur ?',
        a: 'Depuis Achats, créez une commande d\'achat liée à un fournisseur, puis réceptionnez-la (totalement ou partiellement) : le stock et le coût moyen d\'achat de chaque produit sont mis à jour automatiquement.',
      },
      {
        q: 'Comment gérer les dépenses hors achats de stock ?',
        a: 'La section Dépenses permet d\'enregistrer les frais courants (loyer, électricité, transport...) pour un suivi financier complet.',
      },
    ],
  },
  {
    title: 'Clients et promotions',
    entries: [
      {
        q: 'Comment modifier un client ou un produit déjà créé ?',
        a: 'Depuis Produits ou Clients, le bouton « Modifier » sur chaque ligne ouvre le même formulaire que la création, pré-rempli.',
      },
      {
        q: 'Comment créer un code promo ?',
        a: 'Depuis Promotions, définissez un code, un type de remise (pourcentage ou montant fixe) et ses conditions (panier minimum, dates, nombre d\'utilisations). Le caissier le saisit à l\'encaissement.',
      },
    ],
  },
  {
    title: 'Notifications',
    entries: [
      {
        q: 'Comment activer un son de notification personnalisé ?',
        a: 'Dans Réglages → Son de notification, téléversez votre propre fichier audio. Il remplacera le bip par défaut à chaque commande, rupture de stock ou changement de réglages important.',
      },
      {
        q: 'Pourquoi je n\'entends aucun son ?',
        a: 'Vérifiez que le son de votre appareil n\'est pas coupé et que l\'onglet du tableau de bord reste ouvert — les notifications sont vérifiées automatiquement toutes les 15 secondes.',
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
        q: 'Où trouver mes reçus de paiement ?',
        a: 'Dans Abonnement, la section Historique des paiements donne accès à un reçu imprimable ou exportable en PDF pour chaque paiement validé.',
      },
    ],
  },
  {
    title: 'Équipe et permissions',
    entries: [
      {
        q: 'Comment donner accès à un employé sans lui montrer mes revenus ?',
        a: 'Depuis Équipe, invitez-le avec un rôle limité : il ne voit que ce que son rôle autorise — jamais les statistiques financières ni les réglages sensibles, sauf si vous les lui accordez explicitement.',
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

export default function BoutiqueHelpPage() {
  return (
    <>
      <PageHeader
        title="Centre d'aide"
        description="Les réponses aux questions les plus courantes sur MagyaPro Boutique."
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
