import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { StoreRegisterForm } from './store-register-form';

export const metadata: Metadata = {
  title: 'Créer un compte — MagyaPro Boutique',
  description: 'Créez votre compte MagyaPro Boutique et gérez votre commerce en ligne.',
};

export default async function BoutiqueRegisterPage() {
  if (await getCurrentUser()) redirect('/boutique/dashboard');

  return (
    <div className="container-page flex min-h-screen items-center justify-center py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Créer votre compte</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Quelques informations suffisent pour démarrer.
        </p>

        <Suspense fallback={null}>
          <StoreRegisterForm turnstileSiteKey={env.turnstileSiteKey ?? null} />
        </Suspense>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Vous avez déjà un compte ?{' '}
          <Link
            href="/boutique/connexion"
            className="font-medium text-ink underline underline-offset-4"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
