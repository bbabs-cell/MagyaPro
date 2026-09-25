import type { Metadata } from 'next';

import { LegalPage } from '@/components/marketing/legal-page';
import { BRAND, CONTACT_EMAIL, pending } from '@/lib/legal';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedLabel="Version provisoire — en attente de l’état civil de l’entreprise."
      sections={[
        {
          heading: 'Éditeur',
          body: (
            <p>
              {BRAND} est édité par {pending('raison sociale')},{' '}
              {pending('forme juridique')}, immatriculée sous le numéro{' '}
              {pending('identifiant légal')}, dont le siège est situé{' '}
              {pending('adresse')}. Directeur de la publication :{' '}
              {pending('nom')}. Contact : {CONTACT_EMAIL}.
            </p>
          ),
        },
        {
          heading: 'Ce que recouvre le service',
          body: (
            <p>
              {BRAND} regroupe deux produits distincts, facturés séparément et
              dotés de tableaux de bord séparés : <strong>{BRAND} Restaurant</strong>,
              qui donne à un restaurant son site, son menu et ses commandes en
              ligne, et <strong>{BRAND} Boutique</strong>, qui tient la caisse, le
              stock, les achats et les clients d’un commerce. Les présentes
              mentions valent pour les deux.
            </p>
          ),
        },
        {
          heading: 'Hébergement',
          body: (
            <>
              <p>
                L’application et les pages sont hébergées par Vercel Inc.,
                340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
              </p>
              <p>
                Les images et fichiers téléversés par les commerçants sont
                stockés sur Cloudflare R2, opéré par Cloudflare Inc.,
                101 Townsend Street, San Francisco, CA 94107, États-Unis.
              </p>
            </>
          ),
        },
        {
          heading: 'Propriété intellectuelle',
          body: (
            <p>
              Les éléments propres à {BRAND} — textes, logo, mise en page,
              code — sont protégés par le droit d’auteur. Les contenus publiés
              par chaque commerce — menu, photos, descriptions, catalogue —
              restent la propriété de ce commerce, qui en conserve la libre
              disposition.
            </p>
          ),
        },
        {
          heading: 'Nous joindre',
          body: (
            <p>
              Pour toute question relative au site ou au service :{' '}
              {CONTACT_EMAIL}.
            </p>
          ),
        },
      ]}
    />
  );
}
