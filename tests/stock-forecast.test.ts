import { describe, expect, it } from 'vitest';

import { forecastStock } from '@/lib/boutique/stock-forecast';

/**
 * La quantité à commander doit pouvoir être commandée.
 *
 * L'écran des prévisions affichait « 16,48 » boîtes et « 13,02 » bouteilles.
 * Une unité qui ne se fractionne pas s'arrondit au-dessus ; une unité qui se
 * pèse ou se mesure garde ses deux décimales.
 */
const base = {
  stock: 2,
  dailySales: 0.84,
  minStockAlert: 5,
  supplierLeadDays: 7,
  maxStock: null,
};

describe('forecastStock — quantité à commander', () => {
  it('arrondit au-dessus pour une unité entière', () => {
    const forecast = forecastStock({ ...base, decimal: false });
    expect(Number.isInteger(forecast.recommendedQuantity)).toBe(true);
    // Le manque réel, arrondi au-dessus, jamais en dessous.
    const exact = forecastStock({ ...base, decimal: true }).recommendedQuantity;
    expect(forecast.recommendedQuantity).toBe(Math.ceil(exact));
    expect(forecast.recommendedQuantity).toBeGreaterThanOrEqual(exact);
  });

  it('garde deux décimales pour une unité fractionnable', () => {
    const forecast = forecastStock({ ...base, decimal: true });
    expect(forecast.recommendedQuantity).toBe(Math.round(forecast.recommendedQuantity * 100) / 100);
    expect(Number.isInteger(forecast.recommendedQuantity)).toBe(false);
  });

  it('ne gonfle pas un manque entier par une miette de calcul', () => {
    // 10 − 4 = 6 exactement : pas 7.
    const forecast = forecastStock({
      stock: 4,
      dailySales: 1,
      minStockAlert: 1,
      supplierLeadDays: null,
      maxStock: 10,
      decimal: false,
    });
    expect(forecast.recommendedQuantity).toBe(6);
  });

  it('ne recommande rien sans ventes', () => {
    expect(forecastStock({ ...base, dailySales: 0, decimal: false }).recommendedQuantity).toBe(0);
  });
});
