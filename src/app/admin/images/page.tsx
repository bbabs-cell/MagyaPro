import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/session';
import {
  BOUTIQUE_SECTORS,
  boutiqueHowItWorksImageUrl,
  boutiqueLandingAssetUrl,
  boutiqueSectorImageUrl,
  howItWorksImageUrl,
  platformLogoUrl,
} from '@/lib/storage';
import { PlatformLogoUpload } from '@/components/admin/platform-logo-upload';
import { HowItWorksUpload } from '@/components/admin/how-it-works-upload';
import { BoutiqueLandingUpload } from '@/components/admin/boutique-landing-upload';
import { BoutiqueHowItWorksUpload } from '@/components/admin/boutique-how-it-works-upload';
import { BoutiqueSectorUpload } from '@/components/admin/boutique-sector-upload';

const HOW_IT_WORKS_STEPS: Array<{ step: 1 | 2 | 3 | 4; title: string }> = [
  { step: 1, title: 'Créez votre compte' },
  { step: 2, title: 'Décrivez votre restaurant' },
  { step: 3, title: 'Composez votre menu' },
  { step: 4, title: 'Publiez' },
];

const BOUTIQUE_HOW_IT_WORKS_STEPS: Array<{ step: 1 | 2 | 3 | 4; title: string }> = [
  { step: 1, title: 'Créez votre compte' },
  { step: 2, title: 'Configurez votre boutique' },
  { step: 3, title: 'Ajoutez vos produits' },
  { step: 4, title: 'Vendez' },
];

const BOUTIQUE_SECTOR_LABELS: Record<(typeof BOUTIQUE_SECTORS)[number], string> = {
  CLOTHING: 'Habillement',
  ELECTRONICS: 'Électronique',
  COSMETICS: 'Cosmétique',
  GROCERY: 'Alimentation',
  MERCERIE: 'Mercerie',
};

export const metadata: Metadata = { title: 'Images' };
export const dynamic = 'force-dynamic';

export default async function AdminImagesPage() {
  await requireSuperAdmin();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
      <p className="mt-1 text-sm text-white/60">
        Les images de marque affichées sur le site public — logo et illustrations.
      </p>

      <section
        aria-label="Marque"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <h2 className="text-sm font-medium">Logo Magyapro</h2>
        <p className="mt-1 text-xs text-white/50">
          Utilisé partout où la marque apparaît (accueil, connexion, tableau de bord, administration).
        </p>
        <div className="mt-3">
          <PlatformLogoUpload logoUrl={platformLogoUrl()} />
        </div>
      </section>

      <section
        aria-label="Images « Comment ça fonctionne » (Restaurant)"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <h2 className="text-sm font-medium">Images « Comment ça fonctionne » — Restaurant</h2>
        <p className="mt-1 text-xs text-white/50">
          Illustrent les 4 étapes sur <code>/restaurant</code>, avec un dégradé vertical automatique.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map(({ step, title }) => (
            <HowItWorksUpload key={step} step={step} title={title} imageUrl={howItWorksImageUrl(step)} />
          ))}
        </div>
      </section>

      <section
        aria-label="Page d'accueil MagyaPro Boutique"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <h2 className="text-sm font-medium">Page d&apos;accueil MagyaPro Boutique</h2>
        <p className="mt-1 text-xs text-white/50">
          Logo affiché sur <code>/boutique</code> — distinct du logo Magyapro général et du logo
          propre à chaque boutique (réglé par son propriétaire).
        </p>
        <div className="mt-3">
          <BoutiqueLandingUpload imageUrl={boutiqueLandingAssetUrl()} />
        </div>
      </section>

      <section
        aria-label="Images « Comment ça fonctionne » (Boutique)"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <h2 className="text-sm font-medium">Images « Comment ça fonctionne » — Boutique</h2>
        <p className="mt-1 text-xs text-white/50">
          Illustrent les 4 étapes sur <code>/boutique</code>, à la place du dégradé par défaut.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOUTIQUE_HOW_IT_WORKS_STEPS.map(({ step, title }) => (
            <BoutiqueHowItWorksUpload
              key={step}
              step={step}
              title={title}
              imageUrl={boutiqueHowItWorksImageUrl(step)}
            />
          ))}
        </div>
      </section>

      <section
        aria-label="Images par secteur (Boutique)"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <h2 className="text-sm font-medium">Secteurs d&apos;activité — Boutique</h2>
        <p className="mt-1 text-xs text-white/50">
          Une image par secteur, affichée sur <code>/boutique</code> pour illustrer les commerces
          que la plateforme sert.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOUTIQUE_SECTORS.map((sector) => (
            <BoutiqueSectorUpload
              key={sector}
              sector={sector}
              label={BOUTIQUE_SECTOR_LABELS[sector]}
              imageUrl={boutiqueSectorImageUrl(sector)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
