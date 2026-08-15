import type { OrderStatus } from '@prisma/client';

/**
 * Teintes des statuts de commande.
 *
 * Ce sont des couleurs d'état, réservées à cet usage : elles ne servent jamais
 * à distinguer des séries dans un graphique. Elles accompagnent toujours le
 * libellé du statut — la couleur seule ne porte jamais l'information.
 */
export const ORDER_STATUS_TONES: Record<
  OrderStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
> = {
  NEW: 'brand',
  CONFIRMED: 'info',
  PREPARING: 'warning',
  READY: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};
