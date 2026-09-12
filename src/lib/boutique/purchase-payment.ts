import type { Prisma } from '@prisma/client';

import { toQty } from '@/lib/boutique/quantity';

/**
 * Ce qu'une commande fournisseur doit encore, et où en est son règlement.
 *
 * Le suivi reposait sur `Supplier.debtBalance`, un compteur augmenté à chaque
 * réception et diminué à chaque règlement. Un compteur de ce genre est une
 * seconde vérité : il résume des faits qui existent déjà ailleurs, et il finit
 * par s'en écarter sans que rien ne le signale — une réception rejouée, un
 * règlement supprimé, et le solde ment.
 *
 * Ici, rien n'est stocké. Le dû se déduit de ce qui a été livré, le payé de la
 * somme des règlements rattachés, et l'état des deux. Il n'y a donc plus rien
 * à tenir à jour, donc plus rien qui puisse dériver.
 *
 * Module volontairement pur, sans accès à la base : la même règle sert au
 * serveur pour décider et à l'écran pour afficher.
 */

export type PurchasePaymentState = 'unpaid' | 'partial' | 'paid';

export const PURCHASE_PAYMENT_LABELS: Record<PurchasePaymentState, string> = {
  unpaid: 'Non payée',
  partial: 'Payée en partie',
  paid: 'Payée',
};

/**
 * Un fournisseur qu'on n'a pas encore réglé n'est pas en faute : c'est le
 * cours normal des choses jusqu'à l'échéance. L'ambre dit « à régler », pas
 * « anomalie ».
 */
export const PURCHASE_PAYMENT_TONES: Record<PurchasePaymentState, 'success' | 'warning' | 'neutral'> = {
  unpaid: 'warning',
  partial: 'warning',
  paid: 'success',
};

/** Les quantités arrivent en `Decimal` depuis la base, en nombre depuis un test. */
type Quantity = Prisma.Decimal | number;

type PurchaseLine = {
  quantityReceived: Quantity;
  unitFactor: Quantity;
  unitCost: number;
  discount: number;
};

/** Ligne vue du bon de commande, avant toute livraison. */
type OrderedLine = {
  quantityOrdered: Quantity;
  unitFactor: Quantity;
  unitCost: number;
  discount: number;
};

/**
 * Valeur de ce qui a réellement été livré sur une ligne.
 *
 * Même formule que la réception, au franc près : le coût est celui de l'unité
 * d'achat — un carton — et la quantité reçue est comptée en unités de base.
 * Diviser le coût du carton avant de multiplier perdrait des francs à
 * l'arrondi (22 000 / 12 × 12 ≠ 22 000).
 */
export function receivedLineValue(line: PurchaseLine): number {
  const factor = toQty(line.unitFactor) || 1;
  const unit = Math.max(0, line.unitCost - line.discount);
  return Math.round((toQty(line.quantityReceived) / factor) * unit);
}

/** Valeur livrée de toute la commande. Les frais annexes n'en font pas partie. */
export function receivedOrderValue(lines: PurchaseLine[]): number {
  return lines.reduce((sum, line) => sum + receivedLineValue(line), 0);
}

export type PurchasePayment = { amount: number };

export type PurchaseBalance = {
  /** Valeur de ce qui a été livré — ce que le fournisseur peut réclamer. */
  due: number;
  /** Somme des règlements rattachés à cette commande. */
  paid: number;
  /** Ce qui reste à régler, jamais négatif. */
  remaining: number;
  /**
   * Versé au-delà de ce qui est livré. Zéro dans le cas courant.
   *
   * Ce n'est pas forcément une erreur : payer d'avance une commande pas encore
   * arrivée est une pratique fréquente avec un nouveau fournisseur. Mais
   * l'écart était jusqu'ici absorbé sans un mot par un `Math.max(0, …)` — un
   * commerçant qui avait versé quarante mille francs de trop lisait « Payée »
   * et n'apprenait rien. Une avance se voit ; un trop-versé se réclame.
   */
  advance: number;
  state: PurchasePaymentState;
};

export function purchaseBalance(lines: PurchaseLine[], payments: PurchasePayment[]): PurchaseBalance {
  const due = receivedOrderValue(lines);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    due,
    paid,
    remaining: Math.max(0, due - paid),
    advance: Math.max(0, paid - due),
    state: paymentState(due, paid),
  };
}

/**
 * Plafond de ce qu'on peut verser sur une commande : la valeur de ce qui a été
 * commandé, frais annexes compris.
 *
 * Rien n'empêchait jusqu'ici d'enregistrer un règlement de n'importe quel
 * montant. Une faute de frappe — un zéro de trop sur un clavier de téléphone —
 * passait sans un mot et faussait la trésorerie du mois.
 *
 * Le plafond est la valeur **commandée**, et non la valeur livrée : payer
 * d'avance une marchandise qui n'est pas encore arrivée est courant, et le
 * refuser bloquerait une pratique légitime. Au-delà du bon de commande, en
 * revanche, il n'y a plus rien qui justifie le versement.
 */
export function maxPayable(lines: OrderedLine[], extraFees = 0): number {
  const ordered = lines.reduce((sum, line) => {
    const factor = toQty(line.unitFactor) || 1;
    const unit = Math.max(0, line.unitCost - line.discount);
    return sum + Math.round((toQty(line.quantityOrdered) / factor) * unit);
  }, 0);
  return ordered + Math.max(0, extraFees);
}

/**
 * État de règlement.
 *
 * Une commande dont rien n'est encore livré ne doit rien : elle est comptée
 * payée plutôt que « non payée », sans quoi toute commande passée mais pas
 * encore reçue viendrait grossir l'ardoise du fournisseur. On ne doit un
 * montant qu'à partir du moment où la marchandise est arrivée.
 */
export function paymentState(due: number, paid: number): PurchasePaymentState {
  if (due <= 0) return 'paid';
  if (paid <= 0) return 'unpaid';
  return paid >= due ? 'paid' : 'partial';
}
