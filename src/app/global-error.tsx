'use client';

import { useEffect } from 'react';

import { reportToSentry } from '@/lib/error-tracking';

/**
 * Filet de secours quand l'erreur survient dans la mise en page racine
 * elle-même (`layout.tsx`) : `error.tsx` ne peut pas la rattraper puisqu'il
 * en dépend. Next.js impose que ce fichier redéfinisse `<html>`/`<body>`,
 * puisqu'il remplace alors toute la mise en page.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] Erreur de rendu racine :', error);
    reportToSentry(window.__SENTRY_DSN__, error, {
      tags: { boundary: 'global-error', digest: error.digest ?? '' },
    });
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '0 16px', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 600 }}>Une erreur est survenue</h1>
            <p style={{ marginTop: 8, color: '#5b5f68' }}>
              Rechargez la page ; si le problème persiste, contactez le support.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
