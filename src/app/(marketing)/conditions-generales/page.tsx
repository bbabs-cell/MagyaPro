import type { Metadata } from 'next';

import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function ConditionsGeneralesPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      updatedLabel="Version provisoire — en attente de la relecture juridique définitive."
      sections={[
        {
          heading: 'Objet',
          body: (
            <p>
              Les présentes conditions régissent l&apos;utilisation de
              Magyapro, plateforme permettant à un restaurateur de créer un
              site en ligne pour son établissement, d&apos;y présenter son
              menu et de recevoir des commandes.
            </p>
          ),
        },
        {
          heading: 'Création de compte',
          body: (
            <p>
              L&apos;utilisation de Magyapro requiert la création d&apos;un
              compte avec une adresse email valide. Le restaurateur est
              responsable de la confidentialité de ses identifiants et de
              l&apos;exactitude des informations publiées sur son site.
            </p>
          ),
        },
        {
          heading: 'Abonnement et paiement',
          body: (
            <p>
              Chaque compte démarre par une période d&apos;essai. Au-delà,
              l&apos;accès aux fonctionnalités dépend du plan souscrit,
              payable selon les modalités indiquées sur la page{' '}
              <a href="/tarifs" className="underline underline-offset-4">
                Tarifs
              </a>
              . Le restaurateur peut changer de plan ou résilier à tout
              moment depuis son tableau de bord.
            </p>
          ),
        },
        {
          heading: 'Responsabilités',
          body: (
            <p>
              Le restaurateur reste seul responsable du contenu qu&apos;il
              publie (menu, prix, photos, description) ainsi que de la
              bonne exécution des commandes passées par ses clients.
              Magyapro fournit l&apos;outil technique, pas le service de
              restauration lui-même.
            </p>
          ),
        },
        {
          heading: 'Résiliation',
          body: (
            <p>
              Chaque partie peut mettre fin à l&apos;utilisation du service
              à tout moment. [Détail des conséquences sur les données et
              l&apos;accès à compléter.]
            </p>
          ),
        },
        {
          heading: 'Droit applicable',
          body: <p>[Droit applicable et juridiction compétente à préciser.]</p>,
        },
      ]}
    />
  );
}
