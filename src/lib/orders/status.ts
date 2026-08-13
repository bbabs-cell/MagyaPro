import type { OrderStatus } from '@prisma/client';

/**
 * Cycle de vie des commandes — table de vérité partagée.
 *
 * Ce module est volontairement **pur** : aucun accès à la base, aucun module
 * Node. Le serveur l'applique pour valider une transition, l'interface le lit
 * pour n'afficher que les boutons correspondants. Une seule définition, donc
 * jamais de divergence entre ce qui est proposé et ce qui est accepté.
 */

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  OUT_FOR_DELIVERY: 'En livraison',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
