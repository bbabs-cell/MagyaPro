import Link from 'next/link';
import type { Metadata } from 'next';

import { ResetPasswordForm } from './reset-form';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Lien invalide</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Ce lien de réinitialisation est incomplet. Demandez-en un nouveau.
        </p>
        <Link
          href="/mot-de-passe-oublie"
          className="mt-4 inline-block text-sm font-medium text-ink underline underline-offset-4"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Choisissez un nouveau mot de passe pour votre compte.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
