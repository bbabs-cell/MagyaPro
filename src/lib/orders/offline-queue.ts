/**
 * File d'attente des commandes prises au comptoir hors connexion — voir
 * `lib/client/offline-queue.ts`, partagé avec la caisse Boutique.
 */
export function ordersQueueScope(restaurantId: string): string {
  return `orders:${restaurantId}`;
}
