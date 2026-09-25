import type { Metadata } from 'next';

import { LegalPage } from '@/components/marketing/legal-page';
import {
  BRAND,
  CONTACT_EMAIL,
  PROCESSORS,
  RETENTION_STATEMENTS,
  humanDuration,
  pending,
} from '@/lib/legal';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Confidentialité"
      updatedLabel="Version provisoire — en attente de la relecture juridique."
      sections={[
        {
          heading: 'Données collectées',
          body: (
            <>
              <p>
                <strong>Du commerçant et de son équipe</strong> : nom, adresse
                email, rôle, et les informations du commerce — enseigne,
                téléphone, adresse, identifiant légal quand il est renseigné.
              </p>
              <p>
                <strong>Des clients d’un commerce</strong> : nom, téléphone,
                adresse de livraison saisis lors d’une commande, d’une
                réservation ou d’une vente, ainsi que l’historique d’achat et,
                côté Boutique, l’encours de crédit. Une commande prise au
                comptoir sans que le client laisse son numéro ne crée aucune
                fiche client.
              </p>
              <p>
                Ces données appartiennent au commerce qui les a recueillies.
                Elles sont cloisonnées : aucun commerce n’accède aux données
                d’un autre, et cette séparation est appliquée côté serveur, à
                chaque requête.
              </p>
            </>
          ),
        },
        {
          heading: 'Ce à quoi elles servent',
          body: (
            <p>
              Uniquement au fonctionnement du service : tenir le compte,
              traiter les commandes, les ventes et les réservations, suivre le
              stock et les règlements, et permettre au commerce de communiquer
              avec ses clients. Ces données ne sont ni vendues, ni louées, ni
              utilisées pour entraîner un modèle.
            </p>
          ),
        },
        {
          heading: 'Qui d’autre y a accès',
          body: (
            <>
              <p>
                Le service s’appuie sur des prestataires techniques, chacun
                pour une tâche précise :
              </p>
              <ul className="ml-4 list-disc space-y-1">
                {PROCESSORS.map((processor) => (
                  <li key={processor.name}>
                    <strong>{processor.name}</strong> — {processor.role}.
                  </li>
                ))}
              </ul>
              <p>
                Les deux derniers ne sont sollicités qu’après acceptation du
                bandeau de cookies. Sans cette acceptation, aucune mesure
                d’audience n’est effectuée.
              </p>
            </>
          ),
        },
        {
          heading: 'Cookies',
          body: (
            <p>
              {BRAND} dépose des cookies strictement nécessaires — session de
              connexion, préférences d’affichage — sans que votre accord soit
              requis, car le service ne fonctionne pas sans eux. Les cookies de
              mesure d’audience et de campagne ne sont déposés qu’avec votre
              consentement explicite, donné depuis le bandeau affiché en bas de
              page. Vous pouvez revenir sur ce choix en effaçant les cookies de
              votre navigateur.
            </p>
          ),
        },
        {
          heading: 'Combien de temps elles sont gardées',
          body: (
            <>
              <p>
                Les données d’activité d’un commerce sont conservées tant que
                son compte existe : un historique de ventes tronqué au bout de
                quelques mois ne vaudrait rien pour un commerçant.
              </p>
              <p>
                Certaines données techniques sont purgées automatiquement, à
                intervalles fixés :
              </p>
              <ul className="ml-4 list-disc space-y-1">
                {RETENTION_STATEMENTS.map((item) => (
                  <li key={item.what}>
                    {item.what} — {humanDuration(item.days)}.
                  </li>
                ))}
              </ul>
              <p>
                {pending('Durée de conservation après la fermeture d’un compte')}
              </p>
            </>
          ),
        },
        {
          heading: 'Vos droits',
          body: (
            <p>
              Vous pouvez demander l’accès à vos données, leur correction ou
              leur suppression en écrivant à {CONTACT_EMAIL}. Si vous êtes
              client d’un commerce et non commerçant, adressez-vous d’abord à
              ce commerce : c’est lui qui détient vos données et décide de leur
              sort. {pending('Délai de réponse')}
            </p>
          ),
        },
      ]}
    />
  );
}
