import Link from 'next/link';
import type { Metadata } from 'next';

import { ForgotPasswordForm } from './forgot-form';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function ForgotPasswordPage() {
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Indiquez votre adresse email : vous recevrez un lien pour choisir un
        nouveau mot de passe.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/connexion" className="font-medium text-ink underline underline-offset-4">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
