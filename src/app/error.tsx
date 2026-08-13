'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Écran d'erreur applicatif.
 *
 * Le message affiché est volontairement générique : le détail technique reste
 * dans les logs serveur. `digest` est l'identifiant que Next associe à
 * l'erreur — le donner permet au support de retrouver la trace exacte sans
 * exposer quoi que ce soit de sensible.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] Erreur de rendu :', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-ink-muted">
          Nous n&apos;avons pas pu afficher cette page. Réessayez dans un
          instant ; si le problème persiste, contactez le support.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-6 text-sm font-medium text-white hover:bg-ink/90"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-surface-border px-6 text-sm font-medium hover:bg-surface-sunken"
          >
            Retour à l&apos;accueil
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-xs text-ink-faint">
            Référence : {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
