'use client';

/**
 * File d'attente des envois faits hors connexion : les ventes de la caisse
 * Boutique, les commandes prises au comptoir d'un restaurant.
 *
 * Portée volontairement réduite : l'envoi est mis en attente localement
 * (localStorage, survit à la fermeture de l'onglet) puis rejoué dès le retour
 * du réseau, avec le même corps — donc le même `clientRequestId`, qui permet
 * au serveur de rendre ce qu'il a déjà reçu au lieu de le créer deux fois.
 * Aucune résolution de conflit sophistiquée : un envoi que le serveur refuse
 * (stock insuffisant, plat retiré de la carte) échoue avec un message
 * explicite, à traiter à la main plutôt qu'être perdu en silence. Chaque
 * appareil a sa propre file (localStorage n'est pas partagé entre appareils).
 *
 * `scope` désigne la file : `sales:<boutique>`, `orders:<restaurant>`.
 */

const KEY_PREFIX = 'magyapro:offline-';

export type QueuedRequest = {
  id: string;
  /** Corps exact, envoyé tel quel à l'adresse de la file. */
  payload: unknown;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
};

function storageKey(scope: string): string {
  return `${KEY_PREFIX}${scope}`;
}

export function getQueue(scope: string): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

function setQueue(scope: string, queue: QueuedRequest[]): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(queue));
  } catch {
    // Stockage indisponible (navigation privée, quota dépassé...) : l'envoi
    // reste perdu s'il ne peut pas partir immédiatement — dégradé, mais
    // jamais silencieux, l'appelant voit l'échec de l'enregistrement.
  }
}

export function enqueue(scope: string, payload: unknown): QueuedRequest {
  const item: QueuedRequest = {
    id: crypto.randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  setQueue(scope, [...getQueue(scope), item]);
  return item;
}

export function removeFromQueue(scope: string, id: string): void {
  setQueue(scope, getQueue(scope).filter((item) => item.id !== id));
}

export function markQueueItemFailed(scope: string, id: string, error: string): void {
  setQueue(
    scope,
    getQueue(scope).map((item) => (item.id === id ? { ...item, status: 'failed', error } : item)),
  );
}

/**
 * Remet un envoi en échec dans la file, pour un nouvel essai.
 *
 * Un refus n'est pas toujours définitif : « stock insuffisant » cesse de
 * l'être après une réception de marchandise. Sans cela, la seule issue d'un
 * envoi en échec était « Ignorer » — c'est-à-dire le perdre.
 */
export function markQueueItemPending(scope: string, id: string): void {
  setQueue(
    scope,
    getQueue(scope).map((item) => (item.id === id ? { ...item, status: 'pending', error: undefined } : item)),
  );
}
