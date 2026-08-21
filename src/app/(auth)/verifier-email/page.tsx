import Link from 'next/link';
import type { Metadata } from 'next';

import { verifyEmail } from '@/lib/auth/service';
import { getCurrentUser } from '@/lib/auth/session';
import { ResendVerificationButton } from './resend-button';

export const metadata: Metadata = { title: 'Vérification de l\'email' };

/**
 * Deux façons d'arriver ici :
 * - avec un `token` : l'utilisateur vient de cliquer sur le lien reçu par
 *   email, la vérification s'effectue au chargement de la page ;
 * - sans `token` : le tableau de bord a renvoyé ici un compte dont l'email
 *   n'est pas encore confirmé. Rien à vérifier, juste rappeler la marche à
 *   suivre et permettre de renvoyer l'email si besoin.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    const user = await getCurrentUser();
    return (
      <div className="card p-6 text-center sm:p-8">
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-xl text-brand"
        >
          ✉️
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Confirmez votre adresse email
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {user
            ? `Un email a été envoyé à ${user.email}. Ouvrez-le et cliquez sur le lien pour accéder à votre tableau de bord.`
            : 'Ouvrez l\'email que nous vous avons envoyé et cliquez sur le lien de confirmation.'}
        </p>
        {user && <ResendVerificationButton />}
        <Link
          href="/connexion"
          className="mt-6 block text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Se connecter avec un autre compte
        </Link>
      </div>
    );
  }

  let error: string | null = null;
  try {
    await verifyEmail(token);
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'Ce lien de vérification est invalide ou a expiré.';
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
