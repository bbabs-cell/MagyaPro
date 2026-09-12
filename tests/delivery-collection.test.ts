import { describe, expect, it } from 'vitest';

import {
  InvalidCollectionError,
  collectionMethodLabel,
  deliveryPaymentLabel,
  isCollectionMethod,
  resolveCollection,
} from '@/lib/orders/delivery-collection';

/**
 * Encaissement à la livraison.
 *
 * Le point sensible : c'est un livreur, seul chez un client, qui déclare ce
 * qu'il a reçu. Le montant attendu doit venir de la commande et de nulle part
 * ailleurs, sans quoi il suffirait de modifier ce que le téléphone envoie pour
 * minorer une commande et garder la différence.
 */

const TOTAL = 5_000;

describe('Montant encaissé', () => {
  it('retient le total de la commande, jamais le chiffre envoyé, pour un paiement complet', () => {
    // Un téléphone trafiqué enverrait 500 avec « payé en entier ». Le montant
    // saisi est ignoré : seule la commande fait foi.
    expect(resolveCollection(TOTAL, 'full', 500)).toEqual({
      collected: TOTAL,
      shortfall: 0,
      fullyPaid: true,
    });
  });

  it('enregistre l’écart complet quand le client n’a rien payé', () => {
    expect(resolveCollection(TOTAL, 'none')).toEqual({
      collected: 0,
      shortfall: TOTAL,
      fullyPaid: false,
    });
  });

  it('calcule l’écart d’un paiement partiel', () => {
    expect(resolveCollection(TOTAL, 'partial', 3_000)).toEqual({
      collected: 3_000,
      shortfall: 2_000,
      fullyPaid: false,
    });
  });
});

describe('Ce qu’un livreur ne peut pas déclarer', () => {
  it('refuse un partiel supérieur ou égal au total', () => {
    // Sinon un livreur pourrait déclarer avoir reçu plus que dû, et
    // l'excédent apparaîtrait comme une recette du restaurant.
    expect(() => resolveCollection(TOTAL, 'partial', TOTAL)).toThrow(InvalidCollectionError);
    expect(() => resolveCollection(TOTAL, 'partial', TOTAL + 1)).toThrow(InvalidCollectionError);
  });

  it('refuse un partiel nul ou négatif', () => {
    expect(() => resolveCollection(TOTAL, 'partial', 0)).toThrow(InvalidCollectionError);
    expect(() => resolveCollection(TOTAL, 'partial', -100)).toThrow(InvalidCollectionError);
  });

  it('refuse un partiel sans montant, ou avec un montant qui n’est pas entier', () => {
    expect(() => resolveCollection(TOTAL, 'partial')).toThrow(InvalidCollectionError);
    // Les montants sont des entiers en unité mineure : un décimal signale une
    // saisie mal convertie, pas un centime.
    expect(() => resolveCollection(TOTAL, 'partial', 1_500.5)).toThrow(InvalidCollectionError);
  });

  it('refuse un total de commande aberrant', () => {
    expect(() => resolveCollection(-1, 'full')).toThrow(InvalidCollectionError);
    expect(() => resolveCollection(1.5, 'full')).toThrow(InvalidCollectionError);
  });
});

describe('Moyens d’encaissement', () => {
  it('n’accepte que les moyens du registre', () => {
    expect(isCollectionMethod('cash_on_delivery')).toBe(true);
    expect(isCollectionMethod('wave_manual')).toBe(true);
    // Un fournisseur en ligne n'a pas de sens sur le pas d'une porte, et un
    // identifiant inventé ne doit pas entrer dans le journal des paiements.
    expect(isCollectionMethod('wave_api')).toBe(false);
    expect(isCollectionMethod('bitcoin')).toBe(false);
  });

  it('donne un libellé lisible, et retombe sur l’identifiant si besoin', () => {
    expect(collectionMethodLabel('cash_on_delivery')).toBe('Espèces');
    expect(collectionMethodLabel('inconnu')).toBe('inconnu');
  });
});

describe('Ce que le restaurant lit sur une commande livrée', () => {
  it('distingue les trois situations réelles, pas seulement deux', () => {
    // Le §17 en annonce deux ; il en existe une troisième, qui est justement
    // le cas courant du paiement en espèces.
    expect(deliveryPaymentLabel('PAID')).toBe('Payée');
    expect(deliveryPaymentLabel('PROCESSING')).toBe('Encaissée par le livreur');
    expect(deliveryPaymentLabel('PENDING')).toBe('Non payée');
  });

  it('ne dit jamais « en cours », qui ne renseigne personne sur l’argent', () => {
    for (const status of ['PAID', 'PROCESSING', 'PENDING', 'FAILED', 'REFUNDED', 'CANCELLED']) {
      expect(deliveryPaymentLabel(status).toLowerCase()).not.toContain('en cours');
    }
  });

  it('retombe sur le code brut plutôt que sur une case vide', () => {
    expect(deliveryPaymentLabel('AUTRE_CHOSE')).toBe('AUTRE_CHOSE');
  });
});
