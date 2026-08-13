import Link from 'next/link';
import type { Metadata } from 'next';

import { verifyEmail } from '@/lib/auth/service';

export const metadata: Metadata = { title: 'Vérification de l\'email' };

/**
 * La vérification est effectuée au chargement de la page : l'utilisateur
 * arrive depuis son email, il n'a aucune raison d'avoir à cliquer sur un
 * bouton supplémentaire.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let error: string | null = null;
  if (!token) {
    error = 'Ce lien de vérification est incomplet.';
  } else {
    try {
      await verifyEmail(token);
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : 'Ce lien de vérification est invalide ou a expiré.';
    }
  }

  return (
    <div className="card p-6 text-center sm:p-8">
      {error ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vérification impossible
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <p className="mt-6 text-sm text-ink-muted">
            Connectez-vous : vous pourrez demander un nouveau lien depuis votre
            tableau de bord.
          </p>
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-700"
          >
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Adresse confirmée
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Votre adresse email est vérifiée. Vous pouvez accéder à votre espace.
          </p>
        </>
      )}

      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-ink/90"
      >
        Aller à mon tableau de bord
      </Link>
    </div>
  );
}
