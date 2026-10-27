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
import { BoutiqueLandingUpload } from '@/components/admin/boutique-landing-upload';
import { SECTOR_LABELS } from '@/lib/boutique/unit-catalogue';

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

const BOUTIQUE_SECTOR_LABELS = SECTOR_LABELS;

export const metadata: Metadata = { title: 'Images' };
export const dynamic = 'force-dynamic';

export default async function AdminImagesPage() {
  await requireSuperAdmin();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
      <p className="mt-1 text-sm text-fg/60">
        Les images de marque affichées sur le site public — logo et illustrations.
      </p>

      <section
        aria-label="Marque"
        className="mt-6 rounded-xl border border-fg/10 bg-fg/5 p-4"
      >
        <h2 className="text-sm font-medium">Logo MagyaPro</h2>
        <p className="mt-1 text-xs text-fg/60">
          Utilisé partout où la marque apparaît (accueil, connexion, tableau de bord, administration).
        </p>
        <div className="mt-3">
          <PlatformLogoUpload logoUrl={platformLogoUrl()} />
        </div>
      </section>

      <section
        aria-label="Images « Comment ça fonctionne » (Restaurant)"
        className="mt-6 rounded-xl border border-fg/10 bg-fg/5 p-4"
      >
        <h2 className="text-sm font-medium">Images « Comment ça fonctionne » — Restaurant</h2>
        <p className="mt-1 text-xs text-fg/60">
          Livrées avec le code : ce sont des captures de l&apos;application, refaites par{' '}
          <code>scripts/capture-restaurant-illustrations.mjs</code> quand les écrans changent.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map(({ step, title }) => (
            <PlatformImagePreview key={step} title={`${step}. ${title}`} imageUrl={howItWorksImageUrl(step)} />
          ))}
        </div>
      </section>

      <section
        aria-label="Page d'accueil MagyaPro Boutique"
        className="mt-6 rounded-xl border border-fg/10 bg-fg/5 p-4"
      >
        <h2 className="text-sm font-medium">Page d&apos;accueil MagyaPro Boutique</h2>
        <p className="mt-1 text-xs text-fg/60">
          Logo affiché sur <code>/boutique</code> — distinct du logo MagyaPro général et du logo
          propre à chaque boutique (réglé par son propriétaire).
        </p>
        <div className="mt-3">
          <BoutiqueLandingUpload imageUrl={boutiqueLandingAssetUrl()} />
        </div>
      </section>

      <section
        aria-label="Images « Comment ça fonctionne » (Boutique)"
        className="mt-6 rounded-xl border border-fg/10 bg-fg/5 p-4"
      >
        <h2 className="text-sm font-medium">Images « Comment ça fonctionne » — Boutique</h2>
        <p className="mt-1 text-xs text-fg/60">
          Livrées avec le code : ce sont des captures de l&apos;application, refaites par{' '}
          <code>scripts/capture-boutique-illustrations.mjs</code> quand les écrans changent.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOUTIQUE_HOW_IT_WORKS_STEPS.map(({ step, title }) => (
            <PlatformImagePreview key={step} title={`${step}. ${title}`} imageUrl={boutiqueHowItWorksImageUrl(step)} />
          ))}
        </div>
      </section>

      <section
        aria-label="Images par secteur (Boutique)"
        className="mt-6 rounded-xl border border-fg/10 bg-fg/5 p-4"
      >
        <h2 className="text-sm font-medium">Secteurs d&apos;activité — Boutique</h2>
        <p className="mt-1 text-xs text-fg/60">
          Une image par secteur, affichée sur <code>/boutique</code>. Livrées avec le code, dans{' '}
          <code>public/marketing/boutique/</code>.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOUTIQUE_SECTORS.map((sector) => (
            <PlatformImagePreview
              key={sector}
              title={BOUTIQUE_SECTOR_LABELS[sector]}
              imageUrl={boutiqueSectorImageUrl(sector)}
            />
          ))}
        </div>
      </section>
    </>
  );
}

/** Image livrée avec le code : on la montre, on ne la remplace pas d'ici. */
function PlatformImagePreview({ title, imageUrl }: { title: string; imageUrl: string }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- image de plateforme */}
      <img src={imageUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
      <figcaption className="mt-2 text-sm">{title}</figcaption>
    </figure>
  );
}
