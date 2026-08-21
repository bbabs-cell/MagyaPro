import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { LoginForm } from '@/app/(auth)/connexion/login-form';

export const metadata: Metadata = {
  title: 'Connexion — MagyaPro Boutique',
  description: 'Connectez-vous à votre espace MagyaPro Boutique.',
};

/**
 * `/api/auth/login` est commun aux deux produits (Core partagé) : le
 * formulaire de connexion se réutilise donc tel quel, sans duplication —
 * seule la destination après connexion diffère, déjà déterminée côté
 * serveur par la route API à partir de l'hôte de la requête.
 */
export default async function BoutiqueLoginPage() {
  if (await getCurrentUser()) redirect('/boutique/dashboard');

  return (
    <div className="container-page flex min-h-screen items-center justify-center py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Se connecter</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Accédez à votre tableau de bord MagyaPro Boutique.
        </p>

        <LoginForm turnstileSiteKey={env.turnstileSiteKey ?? null} />

        <p className="mt-6 text-center text-sm text-ink-muted">
          Pas encore de compte ?{' '}
          <Link
            href="/boutique/inscription"
            className="font-medium text-ink underline underline-offset-4"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
