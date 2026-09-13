import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * « Une famille nommée dans DESIGN.md est une famille réellement chargée. »
 *
 * Cette règle existe parce qu'elle a déjà été enfreinte : « Inter » a figuré
 * en tête de la pile pendant longtemps sans être téléchargée nulle part. Elle
 * ne s'affichait donc que chez les visiteurs l'ayant installée — c'est-à-dire
 * presque personne — et la documentation décrivait une typographie qui
 * n'existait pas.
 *
 * Rien dans le typage ni dans le rendu ne peut détecter cela : une police
 * absente est silencieusement remplacée par la suivante de la pile. D'où ce
 * test, qui compare la documentation au code de chargement.
 */

const DESIGN = readFileSync('DESIGN.md', 'utf8');
const FONTS = readFileSync('src/lib/fonts.ts', 'utf8');
const GLOBALS = readFileSync('src/app/globals.css', 'utf8');

/**
 * Familles génériques et piles natives : elles ne se téléchargent pas, le
 * système les fournit. Elles n'ont donc rien à faire dans `fonts.ts`.
 */
const NEVER_DOWNLOADED = new Set([
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'system-ui',
  '-apple-system',
  'segoe ui',
  'roboto',
  'helvetica neue',
  'georgia',
  'menlo',
  'sfmono-regular',
  'sans-serif',
  'serif',
  'monospace',
]);

/** Toutes les familles citées par les jetons typographiques de DESIGN.md. */
function documentedFamilies(): string[] {
  const declarations = DESIGN.match(/fontFamily:\s*"([^"]+)"/g) ?? [];
  const families = new Set<string>();

  for (const declaration of declarations) {
    const list = declaration.match(/"([^"]+)"/)?.[1] ?? '';
    for (const raw of list.split(',')) {
      const name = raw.trim().replace(/^['"]|['"]$/g, '');
      if (name && !NEVER_DOWNLOADED.has(name.toLowerCase())) families.add(name);
    }
  }
  return [...families];
}

describe('Typographie documentée', () => {
  it('cite au moins une famille réelle, sinon le test ne prouve rien', () => {
    expect(documentedFamilies().length).toBeGreaterThan(0);
  });

  it('ne nomme aucune famille qui ne soit réellement chargée', () => {
    // `next/font/google` importe la famille sous son nom avec des tirets bas :
    // « Bricolage Grotesque » devient `Bricolage_Grotesque`.
    const missing = documentedFamilies().filter(
      (family) => !FONTS.includes(family.replace(/\s+/g, '_')),
    );

    expect(missing).toEqual([]);
  });

  it('garde une pile de repli derrière chaque police téléchargée', () => {
    // Sans repli, un texte reste invisible le temps du téléchargement, et
    // l'arabe — que ni Manrope ni Bricolage Grotesque ne dessinent — n'a plus
    // aucune police pour l'afficher.
    const declarations = DESIGN.match(/fontFamily:\s*"([^"]+)"/g) ?? [];
    const withoutFallback = declarations.filter((declaration) => {
      const list = declaration.match(/"([^"]+)"/)?.[1] ?? '';
      const parts = list.split(',').map((part) => part.trim().toLowerCase());
      return !parts.some((part) => NEVER_DOWNLOADED.has(part));
    });

    expect(withoutFallback).toEqual([]);
  });

  it('fait passer le corps de texte par la variable de police, pas par un nom en dur', () => {
    // `--font-sans` est remplacée à chaud par les sites publics, qui servent
    // la police choisie par le commerçant. Écrire « Manrope » en dur dans
    // `globals.css` casserait cette substitution.
    expect(GLOBALS).toContain('--font-sans: var(--font-manrope)');
    expect(GLOBALS).not.toMatch(/--font-sans:\s*'?Manrope/);
  });
});
