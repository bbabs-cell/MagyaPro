'use client';

import { useEffect } from 'react';

import { reportToSentry } from '@/lib/error-tracking';

/**
 * Filet de sécurité complémentaire aux limites d'erreur React
 * (`error.tsx`) : capture les erreurs qui ne passent jamais par une
 * limite d'erreur — une exception dans un gestionnaire d'événement, une
 * promesse rejetée sans `.catch()`.
 */
export function ErrorListener() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportToSentry(window.__SENTRY_DSN__, event.error ?? event.message, {
        tags: { boundary: 'window-error' },
      });
    }
    function onRejection(event: PromiseRejectionEvent) {
      reportToSentry(window.__SENTRY_DSN__, event.reason, {
        tags: { boundary: 'unhandled-rejection' },
      });
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
