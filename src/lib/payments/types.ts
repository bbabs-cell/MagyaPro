import type { PaymentStatus } from '@prisma/client';

/**
 * Contrat des fournisseurs de paiement.
 *
 * Magya ne code aucun fournisseur en dur dans sa logique métier : la commande
 * demande un paiement, un fournisseur le traite. Brancher Orange Money ou Wave
 * consistera à implémenter cette interface et à l'enregistrer — sans toucher
 * au tunnel de commande.
 *
 * Les identifiants d'API sont lus depuis l'environnement par le fournisseur
 * lui-même, jamais depuis le code ni depuis une requête cliente.
 */

export type PaymentIntent = {
  /** Notre référence interne, unique, transmise au fournisseur. */
  reference: string;
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: number;
  restaurantId: string;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  /** URL de retour après paiement, pour les fournisseurs par redirection. */
  returnUrl: string;
};

export type PaymentInitResult = {
  status: PaymentStatus;
  /** URL vers laquelle rediriger le client, si le fournisseur en exige une. */
  redirectUrl?: string;
  providerRef?: string;
  /** Consigne affichée au client (« Réglez au livreur », …). */
  instructions?: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentProvider {
  /** Identifiant stable, persisté dans `Order.paymentProvider`. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /**
   * `false` tant que le fournisseur n'est pas réellement branché. Un
   * fournisseur non disponible n'est jamais proposé au client : mieux vaut
   * l'absence d'un moyen de paiement qu'un bouton qui ne paie rien.
   */
  isAvailable(): boolean;
  /** Devises acceptées. Liste vide = toutes. */
  readonly currencies: string[];
  initiate(intent: PaymentIntent): Promise<PaymentInitResult>;
}
