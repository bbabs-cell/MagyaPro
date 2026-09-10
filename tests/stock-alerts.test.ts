import { describe, expect, it } from 'vitest';

import { stockAlertState } from '@/lib/boutique/home-alerts';

/**
 * Règle des alertes de stock.
 *
 * Ces trois états décident de ce qu'un commerçant voit en rouge en ouvrant son
 * tableau de bord. La règle a déjà été réinterprétée de travers une fois : la
 * page « Toutes les boutiques » comptait les ruptures dans le stock bas, si
 * bien que le même commerçant lisait deux chiffres différents pour la même
 * chose selon l'écran ouvert.
 *
 * Les cas ci-dessous sont ceux que les données réelles ne contiennent pas
 * encore — aucune référence en rupture, aucune sans ligne de stock, un seul
 * emplacement partout. Ce sont précisément ceux qui casseront en silence le
 * jour où quelqu'un réécrira ce comptage en SQL pour l'accélérer.
 */
describe('Alertes de stock', () => {
  it('signale une rupture à zéro', () => {
    expect(stockAlertState(0, 5)).toBe('out');
  });

  it('signale une rupture pour un stock négatif', () => {
    // La vente à découvert est autorisée boutique par boutique
    // (`allowNegativeStock`) : le stock peut donc passer sous zéro.
    expect(stockAlertState(-3, 5)).toBe('out');
  });

  it('signale une rupture même sans seuil défini', () => {
    // Un seuil à zéro désactive l'alerte de stock bas, jamais celle de
    // rupture : ne plus rien avoir à vendre est un fait, pas une préférence.
    expect(stockAlertState(0, 0)).toBe('out');
  });

  it('alerte au seuil inclus, pas seulement en dessous', () => {
    // Le seuil est le moment de recommander, pas celui d'être déjà en retard.
    expect(stockAlertState(5, 5)).toBe('low');
    expect(stockAlertState(4, 5)).toBe('low');
    expect(stockAlertState(6, 5)).toBe('ok');
  });

  it('n’alerte jamais sur stock bas quand le seuil est à zéro', () => {
    // Zéro veut dire « je ne veux pas d'alerte sur cette référence ».
    expect(stockAlertState(1, 0)).toBe('ok');
    expect(stockAlertState(1000, 0)).toBe('ok');
  });

  it('accepte les quantités fractionnaires', () => {
    // Le stock est décimal : on vend au kilo et au mètre.
    expect(stockAlertState(0.5, 1)).toBe('low');
    expect(stockAlertState(1.5, 1)).toBe('ok');
    expect(stockAlertState(0.0001, 0)).toBe('ok');
  });

  it('ne classe jamais une référence dans deux états à la fois', () => {
    const cases: Array<[number, number]> = [
      [0, 0],
      [0, 5],
      [-1, 5],
      [5, 5],
      [6, 5],
      [1, 0],
      [0.5, 1],
    ];
    for (const [stock, threshold] of cases) {
      const state = stockAlertState(stock, threshold);
      expect(['out', 'low', 'ok'], `stock=${stock} seuil=${threshold}`).toContain(state);
    }
  });
});
