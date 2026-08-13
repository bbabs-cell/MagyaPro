import type { PaymentStatus } from '@prisma/client';

/**
 * Statuts de paiement — table de vérité partagée, sans dépendance serveur.
 *
 * Les transitions empêchent qu'un webhook rejoué ou reçu dans le désordre ne
 * fasse repasser un paiement remboursé à « payé ».
 */

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED'],
  PROCESSING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  FAILED: ['PENDING', 'PROCESSING'],
  REFUNDED: [],
  CANCELLED: [],
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  PAID: 'Payé',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
  CANCELLED: 'Annulé',
};
