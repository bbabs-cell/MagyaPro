import { describe, expect, it } from 'vitest';

import { DICTIONARY } from '@/lib/i18n/dictionary';

/**
 * Les trois langues de la vitrine doivent porter exactement les mêmes clés.
 *
 * Le typage ne le garantit pas : `Dictionary` est dérivé de la version
 * française (`(typeof DICTIONARY)[Locale]`), si bien qu'une clé oubliée en
 * anglais ou en arabe ne produit une erreur qu'à l'endroit précis où le code
 * la lit — et jamais si cet endroit n'est pas visité pendant la compilation
 * d'une page. À l'exécution, `dict.product.size` vaudrait `undefined` et le
 * client verrait un libellé vide sur un bouton de commande.
 *
 * Le risque est réel : chaque écran traduit ajoute une dizaine de clés à
 * recopier trois fois à la main.
 *
 * Le test compare les chemins de clés, pas les valeurs — deux langues ne
 * doivent surtout pas dire la même chose.
 */

type Node = Record<string, unknown>;

/** Aplatit un dictionnaire en liste de chemins : `product.size`, `cart.view`… */
function keyPaths(node: Node, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    // Une fonction de formatage (`items(n)`) est une feuille, comme une chaîne.
    if (value !== null && typeof value === 'object') {
      paths.push(...keyPaths(value as Node, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

const LOCALES = Object.keys(DICTIONARY) as Array<keyof typeof DICTIONARY>;

describe('Dictionnaires de la vitrine', () => {
  it('déclare les trois langues attendues', () => {
    expect(LOCALES.sort()).toEqual(['ar', 'en', 'fr']);
  });

  it('porte exactement les mêmes clés dans chaque langue', () => {
    const reference = keyPaths(DICTIONARY.fr as Node);

    for (const locale of LOCALES) {
      if (locale === 'fr') continue;
      const paths = keyPaths(DICTIONARY[locale] as Node);

      const missing = reference.filter((path) => !paths.includes(path));
      const extra = paths.filter((path) => !reference.includes(path));

      expect(
        { missing, extra },
        `La langue « ${locale} » ne correspond pas au français.\n` +
          `Clés manquantes : ${missing.join(', ') || 'aucune'}\n` +
          `Clés en trop : ${extra.join(', ') || 'aucune'}`,
      ).toEqual({ missing: [], extra: [] });
    }
  });

  it('n’a pas de valeur vide, dans aucune langue', () => {
    for (const locale of LOCALES) {
      const walk = (node: Node, prefix = ''): void => {
        for (const [key, value] of Object.entries(node)) {
          const path = prefix ? `${prefix}.${key}` : key;
          if (value !== null && typeof value === 'object') {
            walk(value as Node, path);
          } else if (typeof value === 'string') {
            expect(value.trim(), `${locale}.${path} est vide`).not.toBe('');
          }
        }
      };
      walk(DICTIONARY[locale] as Node);
    }
  });
});
