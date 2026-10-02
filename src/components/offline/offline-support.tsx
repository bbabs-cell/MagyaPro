'use client';

import { useEffect, useState } from 'react';

/**
 * Hors connexion, côté page : enregistre l'agent de service (`/sw-app.js`),
 * lui confie les écrans les plus utilisés à préparer, et dit à la personne
 * ce qui marche encore quand le réseau tombe.
 *
 * Voir `public/sw-app.js` pour ce qui est gardé, et surtout ce qui ne l'est
 * jamais : l'API et toute écriture.
 */

export type OfflinePage = { href: string; label: string };

/** Préfixe des caches de pages — partagé avec `sw-app.js`. */
const PAGES_PREFIX = 'magyapro-app-pages-';

/**
 * Identité sous laquelle les pages sont rangées : la personne et le commerce.
 *
 * Hachée, pour que l'adresse e-mail n'apparaisse pas en clair dans un nom de
 * cache. Ce n'est pas un secret — elle ne donne accès à rien — mais il n'y a
 * aucune raison de l'écrire en clair sur le disque.
 */
async function hashIdentity(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/**
 * Efface les pages enregistrées sur cet appareil. À appeler **avant** la
 * déconnexion : sur un téléphone partagé, la personne suivante ne doit pas
 * retrouver hors ligne les clients, les chiffres ou les commandes de la
 * précédente.
 *
 * Les fichiers de l'application (JavaScript, styles) restent : ils ne
 * contiennent aucune donnée de commerce.
 */
export async function clearOfflineCopies(): Promise<void> {
  try {
    if (!('caches' in window)) return;
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(PAGES_PREFIX) || key === 'magyapro-app-meta')
        .map((key) => caches.delete(key)),
    );
  } catch {
    // Stockage indisponible : il n'y avait rien à effacer.
  }
}

export function OfflineSupport({
  scope,
  identity,
  pages,
  offlineMessage,
  enabled = true,
}: {
  /**
   * `/dashboard` ou `/boutique/dashboard` — **sans** barre finale. Une portée
   * `/dashboard/` ne couvre pas l'adresse `/dashboard` elle-même : la vue
   * d'ensemble et le tableau de bord Boutique n'auraient jamais fonctionné
   * hors connexion.
   */
  scope: string;
  /** Personne + commerce, en clair : haché avant tout usage. */
  identity: string;
  /** Les écrans à préparer, **du plus utilisé au moins utilisé**. */
  pages: OfflinePage[];
  /** Ce que la personne lit quand le réseau tombe — propre à chaque produit. */
  offlineMessage: string;
  /** Faux en accès support et en visite de démonstration. */
  enabled?: boolean;
}) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // La liste change rarement ; la sérialiser évite de relancer l'effet à
  // chaque rendu pour un tableau recréé à l'identique.
  const pagesKey = JSON.stringify(pages);

  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    (async () => {
      try {
        await navigator.serviceWorker.register('/sw-app.js', { scope });
        const registration = await navigator.serviceWorker.ready;
        if (cancelled || !registration.active) return;

        const hashed = await hashIdentity(identity);
        const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

        // Préparer les écrans coûte des données : jamais en économie de
        // données, jamais hors ligne. On se contente alors de déclarer
        // l'identité, pour que les pages ouvertes soient rangées au bon
        // endroit.
        registration.active.postMessage(
          navigator.onLine && !connection?.saveData
            ? { type: 'warm', identity: hashed, pages: JSON.parse(pagesKey) }
            : { type: 'identity', identity: hashed },
        );
      } catch {
        // Agent refusé (navigation privée, navigateur ancien) : la page
        // fonctionne comme avant, sans copie hors ligne.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, scope, identity, pagesKey]);

  if (online) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-2xl border border-state-warn/30 bg-state-warn-soft px-4 py-3 text-sm text-state-warn"
    >
      <span className="font-medium">Hors connexion.</span> {offlineMessage}
    </div>
  );
}
