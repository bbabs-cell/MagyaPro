import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/marketing/legal-page';
import { BRAND, CONTACT_EMAIL, pending } from '@/lib/legal';

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function ConditionsGeneralesPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      updatedLabel="Version provisoire — en attente de la relecture juridique."
      sections={[
        {
          heading: 'Objet',
          body: (
            <p>
              Les présentes conditions régissent l’utilisation de {BRAND}, qui
              recouvre deux produits : <strong>{BRAND} Restaurant</strong> — site
              du restaurant, menu, commandes en ligne, livraison, service à
              table — et <strong>{BRAND} Boutique</strong> — caisse, stock, achats
              fournisseurs, clients et crédit. Un même compte peut gérer
              plusieurs commerces, chacun avec son propre abonnement.
            </p>
          ),
        },
        {
          heading: 'Création de compte',
          body: (
            <p>
              L’utilisation de {BRAND} suppose un compte et une adresse email
              valide. Le commerçant répond de la confidentialité de ses
              identifiants, des accès qu’il accorde à son équipe, et de
              l’exactitude des informations qu’il publie.
            </p>
          ),
        },
        {
          heading: 'Abonnement et paiement',
          body: (
            <>
              <p>
                Chaque commerce démarre par une période d’essai. Au-delà,
                l’accès dépend du plan souscrit, aux tarifs indiqués pour{' '}
                <Link href="/restaurant/tarifs" className="underline underline-offset-4">
                  Restaurant
                </Link>{' '}
                et pour{' '}
                <Link href="/boutique/tarifs" className="underline underline-offset-4">
                  Boutique
                </Link>
                . Le commerçant peut changer de plan ou arrêter à tout moment
                depuis son tableau de bord.
              </p>
              <p>
                Le règlement s’effectue par mobile money : le commerçant envoie
                le montant sur le numéro indiqué et dépose sa preuve de
                paiement, qu’un administrateur valide. Aucune carte bancaire
                n’est exigée et aucun prélèvement automatique n’est mis en
                place.
              </p>
            </>
          ),
        },
        {
          heading: 'Ce dont répond le commerçant',
          body: (
            <p>
              Le commerçant reste seul responsable de ce qu’il publie — menu,
              catalogue, prix, photos — ainsi que de l’exécution des commandes
              et des ventes conclues avec ses propres clients. {BRAND} fournit
              l’outil, jamais la prestation commerciale elle-même : la
              plateforme n’est partie à aucune vente entre un commerce et son
              client.
            </p>
          ),
        },
        {
          heading: 'Disponibilité du service',
          body: (
            <p>
              Le service est fourni en l’état, sans garantie de disponibilité
              ininterrompue. Les interventions de maintenance, les incidents
              d’hébergement et les coupures de réseau peuvent le rendre
              temporairement inaccessible. Côté Boutique, la caisse continue
              d’enregistrer les ventes hors ligne et les transmet au retour du
              réseau.
            </p>
          ),
        },
        {
          heading: 'Fin de l’utilisation',
          body: (
            <p>
              Chaque partie peut mettre fin à l’utilisation du service à tout
              moment. Les données du commerce lui appartiennent et restent
              exportables depuis son tableau de bord tant que son accès est
              actif. Un abonnement échu suspend l’accès sans effacer les
              données. {pending('Délai de conservation après résiliation, et modalités de suppression définitive')}
            </p>
          ),
        },
        {
          heading: 'Droit applicable',
          body: (
            <p>
              {pending('Droit applicable et juridiction compétente')} Toute
              question sur les présentes conditions peut être adressée à{' '}
              {CONTACT_EMAIL}.
            </p>
          ),
        },
      ]}
    />
  );
}
