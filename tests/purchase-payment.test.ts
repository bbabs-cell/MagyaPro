import { describe, expect, it } from 'vitest';

import {
  maxPayable,
  paymentState,
  purchaseBalance,
  receivedLineValue,
  receivedOrderValue,
} from '@/lib/boutique/purchase-payment';

/**
 * Règlement d'une commande fournisseur.
 *
 * Ces règles remplacent le compteur `Supplier.debtBalance`. Elles sont testées
 * parce qu'elles décident d'un montant dû : une erreur ici se lit comme une
 * dette envers un grossiste, ce qui se règle en argent réel.
 */

const ligne = (over: Partial<Parameters<typeof receivedLineValue>[0]> = {}) => ({
  quantityReceived: 12,
  unitFactor: 1,
  unitCost: 1000,
  discount: 0,
  ...over,
});

describe('Valeur livrée', () => {
  it('compte ce qui est arrivé, pas ce qui a été commandé', () => {
    expect(receivedLineValue(ligne({ quantityReceived: 0 }))).toBe(0);
    expect(receivedLineValue(ligne({ quantityReceived: 5 }))).toBe(5000);
  });

  it('déduit la remise du coût unitaire', () => {
    expect(receivedLineValue(ligne({ quantityReceived: 10, discount: 200 }))).toBe(8000);
  });

  it('ne rend jamais un montant négatif quand la remise dépasse le coût', () => {
    expect(receivedLineValue(ligne({ unitCost: 500, discount: 900 }))).toBe(0);
  });

  it('ne perd pas de francs sur une unité d’achat groupée', () => {
    // Un carton de 12 à 22 000 F : diviser le coût du carton avant de
    // multiplier ferait perdre des francs à l'arrondi (22 000 / 12 × 12 ≠
    // 22 000). La formule multiplie d'abord.
    const carton = ligne({ quantityReceived: 12, unitFactor: 12, unitCost: 22_000 });
    expect(receivedLineValue(carton)).toBe(22_000);
  });

  it('additionne les lignes d’une commande', () => {
    expect(receivedOrderValue([ligne({ quantityReceived: 2 }), ligne({ quantityReceived: 3 })])).toBe(5000);
  });
});

describe('État de règlement', () => {
  it('considère payée une commande dont rien n’est encore livré', () => {
    // Sinon toute commande passée mais pas encore reçue viendrait grossir
    // l'ardoise du fournisseur, alors qu'on ne lui doit rien.
    expect(paymentState(0, 0)).toBe('paid');
  });

  it('distingue les trois états', () => {
    expect(paymentState(10_000, 0)).toBe('unpaid');
    expect(paymentState(10_000, 4000)).toBe('partial');
    expect(paymentState(10_000, 10_000)).toBe('paid');
  });

  it('considère payée une commande réglée au-delà du dû', () => {
    expect(paymentState(10_000, 12_000)).toBe('paid');
  });
});

describe('Solde d’une commande', () => {
  it('déduit le reste à régler des règlements rattachés', () => {
    const solde = purchaseBalance([ligne({ quantityReceived: 10 })], [{ amount: 3000 }, { amount: 2000 }]);
    expect(solde).toEqual({ due: 10_000, paid: 5000, remaining: 5000, advance: 0, state: 'partial' });
  });

  it('ne rend pas un reste négatif sur un trop-perçu', () => {
    const solde = purchaseBalance([ligne({ quantityReceived: 1 })], [{ amount: 5000 }]);
    expect(solde.remaining).toBe(0);
    expect(solde.state).toBe('paid');
  });

  it('ne doit rien sur une commande passée mais pas encore reçue', () => {
    const solde = purchaseBalance([ligne({ quantityReceived: 0 })], []);
    expect(solde).toEqual({ due: 0, paid: 0, remaining: 0, advance: 0, state: 'paid' });
  });
});

describe('Trop-versé et avance', () => {
  const line = { quantityReceived: 10, unitFactor: 1, unitCost: 1_000, discount: 0 };

  it('signale ce qui a été versé au-delà du livré, au lieu de l’absorber', () => {
    // Le `Math.max(0, …)` sur le reste masquait l'écart : un commerçant qui
    // avait payé quarante mille francs de trop lisait « Payée » et n'en
    // apprenait rien.
    const balance = purchaseBalance([line], [{ amount: 50_000 }]);
    expect(balance.due).toBe(10_000);
    expect(balance.paid).toBe(50_000);
    expect(balance.remaining).toBe(0);
    expect(balance.advance).toBe(40_000);
  });

  it('ne signale aucune avance quand le compte est juste', () => {
    expect(purchaseBalance([line], [{ amount: 10_000 }]).advance).toBe(0);
    expect(purchaseBalance([line], [{ amount: 4_000 }]).advance).toBe(0);
  });

  it('compte comme avance un règlement sur une commande pas encore livrée', () => {
    // Payer d'avance un nouveau fournisseur est courant : ce n'est pas une
    // erreur, mais cela doit se voir.
    const notDelivered = { quantityReceived: 0, unitFactor: 1, unitCost: 1_000, discount: 0 };
    const balance = purchaseBalance([notDelivered], [{ amount: 5_000 }]);
    expect(balance.advance).toBe(5_000);
    expect(balance.remaining).toBe(0);
  });
});

describe('Plafond de règlement', () => {
  it('vaut la valeur commandée, frais annexes compris', () => {
    const lines = [{ quantityOrdered: 10, unitFactor: 1, unitCost: 1_000, discount: 0 }];
    expect(maxPayable(lines, 2_500)).toBe(12_500);
  });

  it('se fonde sur ce qui est commandé, pas sur ce qui est livré', () => {
    // Sinon une avance sur une commande à venir serait refusée.
    const lines = [{ quantityOrdered: 10, unitFactor: 1, unitCost: 1_000, discount: 0 }];
    expect(maxPayable(lines)).toBe(10_000);
  });

  it('tient compte de la remise et de l’unité d’achat groupée', () => {
    // Un carton de 12 à 22 000, remise 1 000 : 24 unités = 2 cartons.
    const lines = [{ quantityOrdered: 24, unitFactor: 12, unitCost: 22_000, discount: 1_000 }];
    expect(maxPayable(lines)).toBe(42_000);
  });

  it('ignore des frais annexes négatifs', () => {
    const lines = [{ quantityOrdered: 1, unitFactor: 1, unitCost: 1_000, discount: 0 }];
    expect(maxPayable(lines, -500)).toBe(1_000);
  });
});
