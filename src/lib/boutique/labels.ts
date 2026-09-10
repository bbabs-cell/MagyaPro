import type { PurchaseOrderStatus, SaleStatus } from '@prisma/client';

/**
 * Libellés et couleurs d'état, source unique.
 *
 * Ces tables étaient recopiées d'un écran à l'autre : les statuts de vente
 * existaient à trois endroits, les moyens de paiement et les statuts d'achat à
 * deux. Chaque copie est une occasion de dériver, et la dérive ne casse rien —
 * elle se contente d'afficher deux vérités différentes selon l'écran ouvert.
 *
 * Le cas concret : ajouter un moyen de paiement à la liste par défaut sans
 * penser à cette copie ferait afficher « Espèces » en caisse et
 * `mobile_money_x` dans les rapports, pour la même vente.
 *
 * Module volontairement pur, sans accès à la base : il est importé aussi bien
 * par des composants client que par du code serveur. C'est la même séparation
 * que `expiry.ts` face à `expiry-load.ts`.
 */

/** Ton visuel d'un badge — miroir de `BadgeTone`, sans importer l'interface. */
export type StateTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

// --- Ventes ----------------------------------------------------------------

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: 'Complétée',
  REFUNDED: 'Remboursée',
  PARTIALLY_REFUNDED: 'Partiellement remboursée',
  CANCELLED: 'Annulée',
};

/**
 * Une annulation et un remboursement sont deux faits comptables distincts :
 * la première n'a jamais encaissé, le second a rendu l'argent. Les peindre de
 * la même couleur les rendait indiscernables d'un coup d'œil.
 */
export const SALE_STATUS_TONES: Record<SaleStatus, StateTone> = {
  COMPLETED: 'success',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'warning',
  CANCELLED: 'danger',
};

export function isSaleStatus(value: string): value is SaleStatus {
  return Object.prototype.hasOwnProperty.call(SALE_STATUS_LABELS, value);
}

// --- Achats ----------------------------------------------------------------

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Brouillon',
  ORDERED: 'Commandée',
  PARTIALLY_RECEIVED: 'Partiellement reçue',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

export const PURCHASE_STATUS_TONES: Record<PurchaseOrderStatus, StateTone> = {
  DRAFT: 'neutral',
  ORDERED: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

/**
 * Variantes tolérantes, pour les écrans où le statut arrive typé `string`
 * (agrégations, projections). Un code inconnu est rendu tel quel plutôt que
 * de laisser une case vide.
 */
export function purchaseStatusLabel(status: string): string {
  return PURCHASE_STATUS_LABELS[status as PurchaseOrderStatus] ?? status;
}

export function purchaseStatusTone(status: string): StateTone {
  return PURCHASE_STATUS_TONES[status as PurchaseOrderStatus] ?? 'neutral';
}

// --- Moyens de paiement ----------------------------------------------------

/**
 * Moyens de paiement proposés à une boutique qui n'a rien configuré.
 *
 * La liste fait foi pour l'affichage comme pour l'amorçage de la table
 * `StorePaymentMethod` : une boutique qui personnalise ses moyens de paiement
 * fait ensuite foi elle-même, mais les codes connus gardent ces libellés.
 */
export const DEFAULT_PAYMENT_METHODS: Array<{ method: string; label: string }> = [
  { method: 'cash', label: 'Espèces' },
  { method: 'orange_money', label: 'Orange Money' },
  { method: 'moov_money', label: 'Moov Money' },
  { method: 'card', label: 'Carte' },
  { method: 'wave', label: 'Wave' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_PAYMENT_METHODS.map(({ method, label }) => [method, label]),
);

/**
 * Libellé d'un moyen de paiement. Le code brut est renvoyé tel quel pour un
 * moyen personnalisé par la boutique : mieux vaut afficher `mobile_money_x`
 * que rien du tout, et la boutique reconnaîtra ce qu'elle a saisi.
 */
export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
