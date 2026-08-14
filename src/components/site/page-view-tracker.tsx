'use client';

import { useEffect } from 'react';

/**
 * Mesure d'audience.
 *
 * L'identifiant de visiteur est un aléa stocké dans `sessionStorage` : il
 * permet de distinguer deux visiteurs sans jamais les identifier, et disparaît
 * à la fermeture de l'onglet. Aucune donnée nominative n'est transmise.
 *
 * L'envoi est silencieux : une mesure qui échoue ne doit rien changer pour le
 * client en train de commander.
 */
export function PageViewTracker({
  restaurantId,
  path,
}: {
  restaurantId: string;
  path: string;
}) {
  useEffect(() => {
    let visitorId: string | null = null;
    try {
      visitorId = window.sessionStorage.getItem('magyapro:visitor');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        window.sessionStorage.setItem('magyapro:visitor', visitorId);
      }
    } catch {
      // Stockage indisponible : la visite est comptée sans identifiant, elle
      // n'entrera simplement pas dans le décompte des visiteurs uniques.
    }

    const payload = JSON.stringify({ restaurantId, type: 'PAGE_VIEW', path, visitorId });

    // `sendBeacon` survit à la navigation : un visiteur qui quitte
    // immédiatement la page est tout de même compté.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/public/analytics',
        new Blob([payload], { type: 'application/json' }),
      );
    } else {
      void fetch('/api/public/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  }, [restaurantId, path]);

  return null;
}
