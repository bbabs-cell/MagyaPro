import type { Metadata } from 'next';

import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedLabel="Version provisoire — en attente des informations officielles de l'entreprise."
      sections={[
        {
          heading: "Éditeur du site",
          body: (
            <p>
              Magyapro est édité par [raison sociale à compléter], [forme
              juridique], immatriculée sous le numéro [numéro
              d&apos;immatriculation], dont le siège social est situé
              [adresse à compléter]. Directeur de la publication : [nom à
              compléter]. Contact : [email de contact à compléter].
            </p>
          ),
        },
        {
          heading: 'Hébergement',
          body: (
            <p>
              Le site est hébergé par Cloudflare, Inc., 101 Townsend
              Street, San Francisco, CA 94107, États-Unis.
            </p>
          ),
        },
        {
          heading: 'Propriété intellectuelle',
          body: (
            <p>
              L&apos;ensemble des éléments du site Magyapro (textes,
              logos, mise en page) est protégé par le droit d&apos;auteur.
              Les contenus publiés par chaque restaurant (menu, photos,
              descriptions) restent la propriété du restaurant concerné.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: <p>Pour toute question relative au site : [email de contact à compléter].</p>,
        },
      ]}
    />
  );
}
