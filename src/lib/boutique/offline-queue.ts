'use client';

/**
 * File d'attente des ventes enregistrées hors ligne — première version du
 * mode hors-ligne de la caisse.
 *
 * Portée volontairement réduite : la vente est mise en attente localement
 * (localStorage, survit à la fermeture de l'onglet) puis envoyée dès le
 * retour du réseau. Aucune résolution de conflit sophistiquée — si deux
 * caisses vendent hors ligne le même stock, la première synchronisée
 * l'emporte (le serveur revalide le stock normalement) et l'autre échoue
 * avec un message explicite, à traiter manuellement (annuler, ou ajuster
 * le stock) plutôt qu'être perdue silencieusement. Chaque poste de caisse a
 * sa propre file (localStorage n'est pas partagé entre appareils).
 */

const KEY_PREFIX = 'magyapro:offline-sales:';

export type QueuedSale = {
  id: string;
  /** Corps exact déjà envoyé tel quel à /api/boutique/sales. */
  payload: unknown;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
};

function storageKey(storeId: string): string {
  return `${KEY_PREFIX}${storeId}`;
}

export function getQueue(storeId: string): QueuedSale[] {
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    return raw ? (JSON.parse(raw) as QueuedSale[]) : [];
  } catch {
    return [];
  }
}

function setQueue(storeId: string, queue: QueuedSale[]): void {
  try {
    localStorage.setItem(storageKey(storeId), JSON.stringify(queue));
  } catch {
    // Stockage indisponible (navigation privée, quota dépassé...) : la vente
    // reste perdue si elle ne peut pas être envoyée immédiatement — dégradé,
    // mais jamais silencieux, l'appelant voit l'échec de l'enregistrement.
  }
}

export function enqueueSale(storeId: string, payload: unknown): QueuedSale {
  const item: QueuedSale = {
    id: crypto.randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  setQueue(storeId, [...getQueue(storeId), item]);
  return item;
}

export function removeFromQueue(storeId: string, id: string): void {
  setQueue(storeId, getQueue(storeId).filter((item) => item.id !== id));
}

export function markQueueItemFailed(storeId: string, id: string, error: string): void {
  setQueue(
    storeId,
    getQueue(storeId).map((item) => (item.id === id ? { ...item, status: 'failed', error } : item)),
  );
}
