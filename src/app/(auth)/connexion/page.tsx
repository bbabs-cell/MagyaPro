import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getCurrentUser } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre espace Magya.',
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Se connecter</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Accédez à votre tableau de bord.
      </p>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-ink-muted">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-medium text-ink underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
