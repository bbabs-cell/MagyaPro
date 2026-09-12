import { describe, expect, it } from 'vitest';

import { describeOptions, readOptions } from '@/lib/orders/option-snapshot';

/**
 * Options figées d'une ligne de commande.
 *
 * Ces valeurs viennent d'une colonne JSON, donc sans garantie de forme. Les
 * écrans les convertissaient jusqu'ici avec un simple `as`, qui n'échoue
 * jamais : une donnée mal formée passait pour valide et s'affichait vide. En
 * cuisine, une option affichée vide vaut une option qu'on ne voit pas — et un
 * plat préparé de travers.
 */

describe('Lecture des options', () => {
  it('lit une liste bien formée', () => {
    expect(
      readOptions([{ groupName: 'Cuisson', optionName: 'Bien cuit', priceDelta: 0 }]),
    ).toEqual([{ groupName: 'Cuisson', optionName: 'Bien cuit', priceDelta: 0 }]);
  });

  it('écarte ce qui n’a pas la forme attendue, sans rien casser', () => {
    const raw = [
      { groupName: 'Cuisson', optionName: 'Saignant', priceDelta: 0 },
      { groupName: 'Cuisson' }, // incomplet
      { groupName: 1, optionName: 2, priceDelta: '3' }, // types faux
      null,
      'sans piment',
    ];
    expect(readOptions(raw)).toEqual([
      { groupName: 'Cuisson', optionName: 'Saignant', priceDelta: 0 },
    ]);
  });

  it('rend une liste vide pour tout ce qui n’est pas un tableau', () => {
    // La colonne a `[]` par défaut, mais une ligne ancienne ou importée peut
    // porter autre chose. Aucun de ces cas ne doit faire tomber un écran.
    expect(readOptions(null)).toEqual([]);
    expect(readOptions(undefined)).toEqual([]);
    expect(readOptions({})).toEqual([]);
    expect(readOptions('sans piment')).toEqual([]);
  });
});

describe('Résumé pour la cuisine', () => {
  it('préfixe par le groupe quand il ajoute une information', () => {
    expect(
      describeOptions([{ groupName: 'Cuisson', optionName: 'Bien cuit', priceDelta: 0 }]),
    ).toBe('Cuisson : Bien cuit');
  });

  it('n’écrit pas deux fois le même mot', () => {
    // « Sans piment : Sans piment » se lit plus mal que « Sans piment ».
    expect(
      describeOptions([{ groupName: 'Piment', optionName: 'Sans piment', priceDelta: 0 }]),
    ).toBe('Sans piment');
  });

  it('sépare plusieurs options lisiblement', () => {
    expect(
      describeOptions([
        { groupName: 'Cuisson', optionName: 'Saignant', priceDelta: 0 },
        { groupName: 'Sauce', optionName: 'Poivre', priceDelta: 500 },
      ]),
    ).toBe('Cuisson : Saignant · Sauce : Poivre');
  });

  it('rend une chaîne vide sans option', () => {
    expect(describeOptions([])).toBe('');
  });
});
