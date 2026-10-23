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

type Tone = (typeof ORDER_STATUS_TONES)[OrderStatus];

/**
 * Classes de chaque ton, écrites en entier pour que Tailwind les retrouve.
 *
 * - `rail` : le liseré gauche d'une commande — son étape se lit d'un coup
 *   d'œil en faisant défiler la liste ;
 * - `dot` : la pastille du filtre correspondant ;
 * - `soft` : un bouton qui **mène** à cet état (« Confirmer » est bleu comme
 *   une commande confirmée), ou un badge.
 */
export const TONE_CLASSES: Record<Tone, { rail: string; dot: string; soft: string }> = {
  brand: { rail: 'border-l-brand', dot: 'bg-brand', soft: 'bg-brand-soft text-brand-text' },
  info: { rail: 'border-l-sky-500', dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700' },
  warning: { rail: 'border-l-state-warn', dot: 'bg-state-warn', soft: 'bg-state-warn-soft text-state-warn' },
  success: { rail: 'border-l-state-ok', dot: 'bg-state-ok', soft: 'bg-state-ok-soft text-state-ok' },
  danger: { rail: 'border-l-state-bad', dot: 'bg-state-bad', soft: 'bg-state-bad-soft text-state-bad' },
  neutral: { rail: 'border-l-surface-border', dot: 'bg-ink-faint', soft: 'bg-surface-sunken text-ink-muted' },
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
