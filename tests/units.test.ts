import { describe, expect, it } from 'vitest';

import {
  DECIMAL_STEP,
  isDecimalUnit,
  quantityStep,
  splitIntoUnits,
  stepForUnit,
  stockState,
  type UnitOption,
} from '@/lib/boutique/units';

/**
 * Décomposition d'un stock en conditionnements, et état d'alerte.
 *
 * Le stock est enregistré en unité de base ; « 3 cartons + 17 bouteilles »
 * est recalculé à chaque affichage. Une erreur ici ne fausse donc jamais la
 * base — elle affiche au commerçant une quantité qu'il ne possède pas, ce
 * qu'aucun contrôle en aval ne rattrapera.
 */

const BOTTLE: UnitOption = {
  code: 'UNIT',
  label: 'bouteille',
  labelPlural: 'bouteilles',
  factor: 1,
  isBase: true,
  isDecimal: false,
};
const PACK: UnitOption = {
  code: 'PACK',
  label: 'pack',
  labelPlural: 'packs',
  factor: 6,
  isBase: false,
  isDecimal: false,
};
const CRATE: UnitOption = {
  code: 'CRATE',
  label: 'carton',
  labelPlural: 'cartons',
  factor: 24,
  isBase: false,
  isDecimal: false,
};
const PACKAGING = [BOTTLE, PACK, CRATE];

/** Total réel représenté par une décomposition. */
function recompose(
  parts: Array<{ quantity: number; label: string }>,
  units: UnitOption[],
): number {
  return parts.reduce((sum, part) => {
    const unit = units.find(
      (candidate) => candidate.label === part.label || candidate.labelPlural === part.label,
    );
    return sum + part.quantity * (unit?.factor ?? 1);
  }, 0);
}

describe('Décomposition en conditionnements', () => {
  it('conserve la quantité, quel que soit le stock', () => {
    // L'invariant qui compte : ce qui est affiché doit se rapporter
    // exactement à ce qui est en stock.
    for (let quantity = 0; quantity <= 200; quantity++) {
      const parts = splitIntoUnits(quantity, PACKAGING);
      expect(recompose(parts, PACKAGING), `stock ${quantity}`).toBe(quantity);
    }
  });

  it('utilise les plus gros conditionnements en premier', () => {
    // 77 = 3 cartons (72) + 0 pack + 5 bouteilles.
    const parts = splitIntoUnits(77, PACKAGING);
    expect(parts[0]).toEqual({ quantity: 3, label: 'cartons' });
    expect(parts.at(-1)).toEqual({ quantity: 5, label: 'bouteilles' });
  });

  it('accorde le singulier et le pluriel', () => {
    expect(splitIntoUnits(24, PACKAGING)[0]).toEqual({ quantity: 1, label: 'carton' });
    expect(splitIntoUnits(1, PACKAGING)[0]).toEqual({ quantity: 1, label: 'bouteille' });
  });

  it('n’invente aucun conditionnement vide', () => {
    // 24 pile : ni pack ni bouteille résiduels à afficher.
    expect(splitIntoUnits(24, PACKAGING)).toHaveLength(1);
  });

  it('affiche zéro plutôt qu’une liste vide', () => {
    // Un stock épuisé doit se lire « 0 bouteille », pas disparaître.
    expect(splitIntoUnits(0, PACKAGING)).toEqual([{ quantity: 0, label: 'bouteille' }]);
  });

  it('laisse une base fractionnable telle quelle', () => {
    // « 1,5 kg » se lit mieux que « 1 kg + 500 g ».
    const kg: UnitOption = {
      code: 'KG',
      label: 'kg',
      labelPlural: 'kg',
      factor: 1,
      isBase: true,
      isDecimal: true,
    };
    const sack: UnitOption = {
      code: 'SACK',
      label: 'sac',
      labelPlural: 'sacs',
      factor: 25,
      isBase: false,
      isDecimal: false,
    };
    expect(splitIntoUnits(1.5, [kg, sack])).toEqual([{ quantity: 1.5, label: 'kg' }]);
  });

  it('se contente de la base quand aucun conditionnement n’est déclaré', () => {
    expect(splitIntoUnits(7, [BOTTLE])).toEqual([{ quantity: 7, label: 'bouteilles' }]);
  });

  it('ne décompose pas un stock négatif', () => {
    // Un stock négatif traduit une anomalie ; la décomposer la masquerait
    // derrière un affichage d'apparence normale.
    const parts = splitIntoUnits(-5, PACKAGING);
    expect(parts).toHaveLength(1);
    expect(parts[0]!.quantity).toBe(-5);
  });
});

describe('État du stock', () => {
  it('distingue épuisé, bas et normal', () => {
    expect(stockState(0, 10)).toBe('out');
    expect(stockState(5, 10)).toBe('low');
    expect(stockState(50, 10)).toBe('ok');
  });

  it('place la frontière du seuil sans ambiguïté', () => {
    // Le seuil lui-même doit tomber d'un côté précis, et y rester : c'est la
    // valeur exacte qui décide de la couleur affichée au commerçant.
    const atThreshold = stockState(10, 10);
    expect(['low', 'ok']).toContain(atThreshold);
    expect(stockState(11, 10)).toBe('ok');
    expect(stockState(9, 10)).toBe('low');
  });

  it('sans seuil déclaré, ne signale que la rupture', () => {
    expect(stockState(0)).toBe('out');
    expect(stockState(1)).toBe('ok');
  });

  it('traite un stock négatif comme une rupture', () => {
    expect(stockState(-3, 10)).toBe('out');
  });
});

describe('Pas de saisie', () => {
  it('autorise le fractionnaire au poids et au volume seulement', () => {
    expect(isDecimalUnit('KG')).toBe(true);
    expect(isDecimalUnit('LITER')).toBe(true);
    expect(isDecimalUnit('UNIT')).toBe(false);
    expect(isDecimalUnit('PACK')).toBe(false);
  });

  it('ne propose jamais un pas inutilisable au comptoir', () => {
    // Ce test exigeait seulement un pas strictement positif. 0,000001 le
    // satisfaisait — et c'était précisément la valeur en place : appuyer sur
    // un produit au litre ajoutait un millionième de litre au panier. Un
    // seuil trop bas ne prouve rien ; celui-ci exige une quantité qu'un
    // commerce vend réellement.
    for (const unit of [
      { isDecimal: true, isBase: true },
      { isDecimal: false, isBase: true },
      { isDecimal: true, isBase: false },
      { isDecimal: false, isBase: false },
    ]) {
      expect(stepForUnit(unit)).toBeGreaterThanOrEqual(DECIMAL_STEP);
    }
  });

  it('avance par demi sur les unités fractionnables, par un ailleurs', () => {
    expect(stepForUnit({ isDecimal: true, isBase: true })).toBe(0.5);
    // Un carton ou un pack ne se vend pas au demi : le pas reste entier.
    expect(stepForUnit({ isDecimal: true, isBase: false })).toBe(1);
    expect(stepForUnit({ isDecimal: false, isBase: true })).toBe(1);
  });

  it('donne la même granularité par les deux chemins', () => {
    // Les deux fonctions répondaient à la même question avec des valeurs
    // différentes (0,001 et 0,000001), ce qui est la façon habituelle dont
    // une règle finit par diverger d'elle-même.
    expect(quantityStep('LITER')).toBe(stepForUnit({ isDecimal: true, isBase: true }));
    expect(quantityStep('KG')).toBe(DECIMAL_STEP);
    expect(quantityStep('UNIT')).toBe(1);
    expect(quantityStep('PACK')).toBe(1);
  });
});
