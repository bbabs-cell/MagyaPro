'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker du site public.
 *
 * L'enregistrement est différé après le chargement complet : il ne doit pas
 * disputer de la bande passante au premier affichage, qui est ce que le client
 * attend réellement.
 */
export function ServiceWorkerRegistration({ scope }: { scope: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function register() {
      navigator.serviceWorker.register('/sw.js', { scope }).catch(() => {
        // Enregistrement refusé (contexte non sécurisé, navigation privée) :
        // le site fonctionne normalement, simplement sans mode hors ligne.
      });
    }

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, [scope]);

  return null;
}
