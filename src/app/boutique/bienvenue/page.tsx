import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth/session';
import { getStoreContext } from '@/lib/boutique/store-tenant';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Configurer ma boutique' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/boutique/connexion');

  const context = await getStoreContext();
  // Un compte connecté mais sans boutique (ex. session existante d'un compte
  // Restaurant) ne doit pas repartir vers `/boutique/connexion` : cette page
  // renvoie aussitôt un utilisateur déjà connecté vers `/boutique/dashboard`,
  // qui renvoie ici en l'absence de contexte — une boucle infinie.
  if (!context) redirect('/boutique');

  // Déjà configurée : rien à faire ici, les mêmes réglages restent
  // modifiables depuis le tableau de bord.
  if (context.store.onboardingCompletedAt) redirect('/boutique/dashboard');

  return (
    <div className="container-page flex min-h-screen items-center justify-center py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configurons « {context.store.name} »
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Quelques informations pour démarrer. Vous pourrez tout modifier
          ensuite.
        </p>

        <OnboardingForm />
      </div>
    </div>
  );
}
