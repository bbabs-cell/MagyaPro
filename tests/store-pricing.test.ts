import { describe, expect, it } from 'vitest';

import { additionalStorePrice, DEFAULT_ADDITIONAL_STORE_PERCENT } from '@/lib/boutique/store-pricing';

/**
 * Tarif d'une boutique supplémentaire.
 *
 * La règle tient en une ligne de code, ce qui la rend facile à casser sans
 * s'en apercevoir : une majoration mal appliquée ne plante rien, elle facture
 * simplement le mauvais montant, tous les mois, à tout le monde. D'où ces
 * exemples chiffrés, repris de ceux annoncés aux commerçants.
 */
describe('Tarif des boutiques supplémentaires', () => {
  it('facture une boutique de plus à 75 % du tarif du plan', () => {
    expect(DEFAULT_ADDITIONAL_STORE_PERCENT).toBe(75);
    // Premium à 25 000 : la deuxième boutique coûte 18 750, soit 43 750 au total.
    expect(additionalStorePrice(25_000, 75)).toBe(18_750);
    // Pro à 10 000 : 7 500 de plus, soit 17 500 au total.
    expect(additionalStorePrice(10_000, 75)).toBe(7_500);
  });

  it('reste linéaire : chaque boutique en plus coûte le même supplément', () => {
    const extra = additionalStorePrice(25_000, 75);
    expect(25_000 + extra).toBe(43_750); // 2 boutiques
    expect(25_000 + extra * 2).toBe(62_500); // 3 boutiques
    expect(25_000 + extra * 3).toBe(81_250); // 4 boutiques
  });

  it('arrondit à l’unité mineure plutôt que de laisser des centimes', () => {
    // 9 990 × 75 % = 7 492,5. Un montant à virgule n'est pas payable en XOF.
    expect(additionalStorePrice(9_990, 75)).toBe(7_493);
    expect(Number.isInteger(additionalStorePrice(3_333, 75))).toBe(true);
  });

  it('suit le pourcentage configuré, sans valeur codée en dur', () => {
    expect(additionalStorePrice(25_000, 60)).toBe(15_000);
    expect(additionalStorePrice(25_000, 100)).toBe(25_000);
    // 0 % : une boutique supplémentaire devient gratuite. Réglage extrême mais
    // légitime, il ne doit pas retomber sur une valeur par défaut.
    expect(additionalStorePrice(25_000, 0)).toBe(0);
  });
});
