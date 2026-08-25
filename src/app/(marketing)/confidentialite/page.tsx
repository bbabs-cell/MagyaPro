import type { Metadata } from 'next';

import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedLabel="Version provisoire — en attente de la relecture juridique définitive."
      sections={[
        {
          heading: 'Données collectées',
          body: (
            <p>
              Pour les restaurateurs : nom, email, informations du
              restaurant. Pour les clients d&apos;un restaurant : nom,
              coordonnées et adresse de livraison saisis lors d&apos;une
              commande ou d&apos;une réservation. Ces données restent
              propres à chaque restaurant et ne sont jamais partagées entre
              établissements.
            </p>
          ),
        },
        {
          heading: 'Finalité',
          body: (
            <p>
              Ces données servent uniquement au fonctionnement du service :
              gestion du compte, traitement des commandes et réservations,
              communication liée à l&apos;activité du restaurant.
            </p>
          ),
        },
        {
          heading: 'Cookies',
          body: (
            <p>
              Magyapro dépose des cookies strictement nécessaires (maintien
              de la session de connexion, mémoire des préférences
              d&apos;affichage) sans que votre accord ne soit requis. Avec
              votre consentement explicite (bandeau affiché en bas de page),
              des cookies de mesure d&apos;audience (Google Analytics) et
              publicitaires (Meta) peuvent aussi être déposés, pour
              comprendre l&apos;usage du site et mesurer nos campagnes. Vous
              pouvez à tout moment refuser ces derniers ou revenir sur votre
              choix en effaçant les cookies de votre navigateur.
            </p>
          ),
        },
        {
          heading: 'Vos droits',
          body: (
            <p>
              Vous pouvez demander l&apos;accès, la correction ou la
              suppression de vos données en écrivant à contact@magyapro.com.
              [Délai de réponse et procédure détaillée à préciser.]
            </p>
          ),
        },
        {
          heading: 'Conservation',
          body: <p>[Durée de conservation des données à préciser.]</p>,
        },
      ]}
    />
  );
}
