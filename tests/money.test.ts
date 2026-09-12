import { describe, expect, it } from 'vitest';

import {
  amountIn,
  currencySymbol,
  formatMoney,
  hasSeveralCurrencies,
  primaryCurrency,
  sumByCurrency,
  toMajor,
  toMinor,
} from '@/lib/money';

/**
 * Écriture des montants.
 *
 * Le défaut qui a motivé ces tests : le symbole venait des données de langue
 * du moteur, et ces données varient d'un appareil à l'autre. Le même montant
 * s'affichait « F CFA » dans les pages rendues par le serveur et « XOF » dans
 * celles rendues par le navigateur d'un téléphone Android. Les assertions qui
 * existaient alors — `toContain('5')` — ne pouvaient pas le voir.
 */

describe('Symbole de devise', () => {
  it('écrit le franc CFA en toutes lettres, jamais son code ISO', () => {
    expect(formatMoney(14_362_650, 'XOF')).toContain('F CFA');
    expect(formatMoney(14_362_650, 'XOF')).not.toContain('XOF');
  });

  it('ne dépend pas de la casse du code passé', () => {
    expect(currencySymbol('xof')).toBe('F CFA');
    expect(currencySymbol('XOF')).toBe('F CFA');
  });

  it('retombe sur le code ISO pour une devise inconnue', () => {
    // Mieux vaut un code brut qu'une case vide ou une exception en plein rendu.
    expect(currencySymbol('ZZZ')).toBe('ZZZ');
    expect(formatMoney(500, 'ZZZ')).toContain('ZZZ');
  });
});

describe('Écriture des montants', () => {
  it('n’affiche aucune décimale pour une devise qui n’en a pas', () => {
    expect(formatMoney(400, 'XOF')).toBe('400 F CFA');
    expect(formatMoney(0, 'XOF')).toBe('0 F CFA');
  });

  it('affiche deux décimales pour l’euro, à la française', () => {
    expect(formatMoney(1250, 'EUR')).toBe('12,50 €');
  });

  it('sépare les milliers par une espace insécable ordinaire', () => {
    // Les versions récentes du moteur emploient une espace fine insécable,
    // les anciennes une espace insécable ordinaire. Sans normalisation, le
    // serveur et le navigateur produisent deux chaînes différentes pour le
    // même montant — ce que React signale à l'hydratation.
    const rendu = formatMoney(14_362_650, 'XOF');
    expect(rendu).toBe('14 362 650 F CFA');
    expect(rendu).not.toContain(' ');
  });
});

describe('Conversion en unité mineure', () => {
  it('ne crée pas de décimale là où la devise n’en a pas', () => {
    expect(toMinor('400', 'XOF')).toBe(400);
    expect(toMajor(400, 'XOF')).toBe(400);
  });

  it('accepte la virgule décimale française', () => {
    expect(toMinor('12,50', 'EUR')).toBe(1250);
  });
});

/**
 * Totaux qui traversent plusieurs commerces.
 *
 * Le défaut à l'origine : le cumul multi-boutiques additionnait les recettes
 * sans regarder la monnaie, puis les affichait dans celle de la première
 * boutique de la liste. Deux francs CFA distincts circulent dans la zone visée
 * — celui d'Afrique de l'Ouest et celui d'Afrique centrale — et rien à l'écran
 * ne signalait le mélange.
 */
describe('Cumul par devise', () => {
  it('additionne à devise égale et sépare les devises différentes', () => {
    expect(
      sumByCurrency([
        { amount: 1000, currency: 'XOF' },
        { amount: 500, currency: 'XAF' },
        { amount: 250, currency: 'XOF' },
      ]),
    ).toEqual({ XOF: 1250, XAF: 500 });
  });

  it('regroupe les codes quelle que soit leur casse', () => {
    expect(sumByCurrency([
      { amount: 100, currency: 'xof' },
      { amount: 100, currency: 'XOF' },
    ])).toEqual({ XOF: 200 });
  });

  it('désigne comme principale la devise qui pèse le plus lourd', () => {
    expect(primaryCurrency({ XAF: 300, XOF: 900 })).toBe('XOF');
  });

  it('retombe sur la devise par défaut quand il n’y a rien à totaliser', () => {
    expect(primaryCurrency({})).toBe('XOF');
    expect(primaryCurrency({}, 'EUR')).toBe('EUR');
  });

  it('lit un montant dans une devise absente comme zéro, sans échouer', () => {
    expect(amountIn({ XOF: 400 }, 'XAF')).toBe(0);
    expect(amountIn({ XOF: 400 }, 'xof')).toBe(400);
  });

  it('ne signale un mélange que si deux devises portent réellement un montant', () => {
    expect(hasSeveralCurrencies({ XOF: 1000 })).toBe(false);
    // Une devise à zéro vient d'un seau préparé d'avance, pas d'une recette :
    // elle ne doit pas déclencher l'avertissement.
    expect(hasSeveralCurrencies({ XOF: 1000, XAF: 0 })).toBe(false);
    expect(hasSeveralCurrencies({ XOF: 1000, XAF: 5 })).toBe(true);
    expect(hasSeveralCurrencies({})).toBe(false);
  });
});
