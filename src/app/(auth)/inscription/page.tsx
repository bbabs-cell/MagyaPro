import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Créer un compte',
  description: 'Créez votre compte Magyapro et mettez votre restaurant en ligne.',
};

export default async function RegisterPage() {
  // Un utilisateur déjà connecté n'a rien à faire sur cette page.
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Créer votre compte</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Quelques informations suffisent pour démarrer.
      </p>

      <Suspense fallback={null}>
        <RegisterForm turnstileSiteKey={env.turnstileSiteKey ?? null} />
      </Suspense>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion" className="font-medium text-ink underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
