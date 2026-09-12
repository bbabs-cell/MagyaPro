import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Garde-fou contre le gel des données du serveur.
 *
 * Sept écrans de gestion — produits, menu, achats, clients, dépenses,
 * promotions — recopiaient les données reçues du serveur dans un `useState`
 * dont le setter n'était jamais utilisé :
 *
 * ```
 * const [products] = useState(initialProducts);
 * ```
 *
 * L'écriture paraît anodine et ne l'est pas. `useState` ne lit sa valeur
 * initiale qu'au premier rendu et ignore toutes les suivantes. La liste
 * restait donc figée sur le contenu qu'elle avait à l'ouverture de la page :
 * chaque `router.refresh()` allait chercher des données fraîches que rien
 * n'affichait, et un produit créé ou un prix corrigé n'apparaissaient qu'après
 * un rechargement complet du navigateur.
 *
 * Ce test n'exécute rien : il relit le code. Le défaut est invisible au
 * typage — le programme est parfaitement valide — et invisible à la lecture,
 * puisque la ligne ressemble à une déclaration d'état ordinaire. Seule une
 * relecture ciblée le rattrape.
 *
 * Une donnée du serveur se lit directement depuis sa propriété. `useState`
 * n'est légitime que pour un état que l'écran fait évoluer lui-même — et il
 * a alors un setter.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');

/** `const [x] = useState(...)` — un état sans setter, donc figé pour de bon. */
const FROZEN_STATE = /const\s+\[\s*[A-Za-z0-9_$]+\s*\]\s*=\s*useState\s*\(/g;

function collectSources(directory: string, into: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collectSources(path, into);
    } else if (path.endsWith('.tsx') || path.endsWith('.ts')) {
      into.push(path);
    }
  }
  return into;
}

describe('Données du serveur', () => {
  it('ne sont jamais recopiées dans un état sans setter', () => {
    const offenders: string[] = [];

    for (const path of collectSources(SOURCE_ROOT)) {
      const source = readFileSync(path, 'utf8');
      const matches = source.match(FROZEN_STATE);
      if (matches) {
        offenders.push(`${path.slice(process.cwd().length + 1)} (${matches.length})`);
      }
    }

    // Le message d'échec doit dire quoi faire : celui qui le lira aura sans
    // doute écrit la ligne fautive sans se douter qu'elle gèle son écran.
    expect(
      offenders,
      `Ces fichiers figent des données du serveur dans un useState sans setter.\n` +
        `La valeur initiale d'un useState n'est lue qu'au premier rendu : l'écran\n` +
        `ne se mettra plus jamais à jour. Lisez la propriété directement.\n\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
