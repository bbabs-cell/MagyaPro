import type { OrderStatus } from '@prisma/client';

import type { Tone } from '@/components/dashboard/tones';

export { TONE_CLASSES } from '@/components/dashboard/tones';

/**
 * Teintes des statuts de commande.
 *
 * Même grille que tout le tableau de bord : voir `tones.ts`.
 */
export const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
  NEW: 'brand',
  CONFIRMED: 'info',
  PREPARING: 'warning',
  READY: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Libellé d'un bouton qui fait passer la commande à cet état — un verbe.
 * « Confirmée » sur un bouton se lisait comme un statut, pas comme un geste.
 */
export const ORDER_ACTION_LABELS: Record<OrderStatus, string> = {
  NEW: 'Rouvrir',
  CONFIRMED: 'Confirmer',
  PREPARING: 'Lancer la préparation',
  READY: 'Marquer prête',
  OUT_FOR_DELIVERY: 'Envoyer en livraison',
  DELIVERED: 'Marquer livrée',
  COMPLETED: 'Terminer',
  CANCELLED: 'Annuler',
};

/** Ton du paiement : vert encaissé, ambre à encaisser, rouge refusé. */
export const PAYMENT_STATUS_TONES: Record<string, Tone> = {
  PAID: 'success',
  PROCESSING: 'info',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  CANCELLED: 'neutral',
};
