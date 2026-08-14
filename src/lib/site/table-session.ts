'use client';

/**
 * Session de table, côté client.
 *
 * Scanner le QR d'une table mémorise son jeton dans `localStorage`, cloisonné
 * par restaurant comme le panier (`cart-context.tsx`). Le tunnel de commande
 * le relit pour basculer automatiquement en mode « sur place », sans qu'il
 * faille faire transiter le jeton par chaque lien du site.
 */

function storageKey(restaurantId: string): string {
  return `magyapro:table:${restaurantId}`;
}

export function getTableToken(restaurantId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(restaurantId));
  } catch {
    return null;
  }
}

export function setTableToken(restaurantId: string, token: string): void {
  try {
    window.localStorage.setItem(storageKey(restaurantId), token);
  } catch {
    // Stockage indisponible (navigation privée) : la commande à table ne
    // sera simplement pas proposée, sans casser la page.
  }
}

export function clearTableToken(restaurantId: string): void {
  try {
    window.localStorage.removeItem(storageKey(restaurantId));
  } catch {
    // Rien à faire : au pire le jeton périmé reste, sans conséquence.
  }
}
