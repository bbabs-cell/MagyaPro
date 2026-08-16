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
              Magyapro utilise uniquement des cookies strictement
              nécessaires : maintien de la session de connexion et mémoire
              des préférences d&apos;affichage (thème clair/sombre, langue).
              Aucun cookie de mesure d&apos;audience ni de publicité
              n&apos;est déposé à ce jour.
            </p>
          ),
        },
        {
          heading: 'Vos droits',
          body: (
            <p>
              Vous pouvez demander l&apos;accès, la correction ou la
              suppression de vos données en écrivant à [email de contact à
              compléter]. [Délai de réponse et procédure détaillée à
              préciser.]
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
