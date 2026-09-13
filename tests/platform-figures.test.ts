import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Deux règles qui ne peuvent pas être vérifiées par le typage et que la base
 * de données ne dira jamais : les chiffres de la plateforme ne mélangent pas
 * les devises, et ils excluent les vitrines de démonstration.
 *
 * Elles sont donc vérifiées sur le texte des sources, comme
 * `reactivity.test.ts`. C'est grossier, mais ces deux défauts sont revenus
 * chacun au moins une fois, et ils sont invisibles à l'écran : un total faux
 * ressemble exactement à un total juste.
 */

function filesUnder(directory: string, extension = '.tsx'): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path, extension));
    else if (path.endsWith(extension)) found.push(path);
  }
  return found;
}

describe('Chiffres du Super Admin — devises', () => {
  it("n'affiche jamais un montant dans une devise écrite en dur", () => {
    // Le défaut réel : `formatMoney(metrics.grossVolume, 'XOF')` sur un total
    // qui additionnait toutes les devises. Le nombre n'était pas seulement
    // ambigu, il affirmait une devise qu'il n'avait pas.
    const offenders: string[] = [];

    for (const file of filesUnder(join('src', 'app', 'admin'))) {
      const source = readFileSync(file, 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        // Deux conditions sur la même ligne plutôt qu'une seule expression :
        // un argument imbriqué — `formatMoney(amountIn(x, c), 'XOF')` — ferme
        // une parenthèse au milieu et échappait à la version précédente.
        if (/formatMoney\(/.test(line) && /['"][A-Z]{3}['"]\s*\)/.test(line)) {
          offenders.push(`${file}:${index + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('Chiffres du Super Admin — vitrines de démonstration', () => {
  /**
   * Le jeu de démonstration crée des abonnements actifs valables trente
   * jours. Sans filtre, un mois plus tard la vue d'ensemble réclamait une
   * action sur des comptes qui n'appartiennent à personne.
   */
  it('exclut les démonstrations de toutes les lectures de la recette', () => {
    const source = readFileSync(join('src', 'lib', 'platform-revenue.ts'), 'utf8');

    // Seules les lectures qui traversent tous les commerces sont concernées.
    // `listRestaurantPayments` et `listStorePayments`, elles, sont bornées à
    // un identifiant : ouvrir la fiche d'une démonstration doit bien montrer
    // ses paiements. Le test porte donc sur le corps de `getPlatformRevenue`,
    // et non sur le fichier entier.
    const start = source.indexOf('export async function getPlatformRevenue');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('\nexport ', start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);

    // Un fragment par appel : découper sur `prisma.` isole chaque requête,
    // sans dépendre de l'indentation comme le ferait une expression régulière
    // sur l'accolade fermante.
    const [, ...calls] = body.split('prisma.');
    expect(calls.length).toBe((body.match(/prisma\./g) ?? []).length);
    expect(calls.length).toBeGreaterThanOrEqual(8);

    const unfiltered = calls.filter(
      (call) => !call.includes('NOT_DEMO_RESTAURANT') && !call.includes('NOT_DEMO_STORE'),
    );
    expect(unfiltered.map((call) => call.slice(0, 60))).toEqual([]);
  });

  it('exclut les démonstrations des statistiques des deux produits', () => {
    for (const [file, marker] of [
      [join('src', 'lib', 'analytics.ts'), 'NOT_DEMO_RESTAURANT'],
      [join('src', 'lib', 'boutique', 'platform-analytics.ts'), 'NOT_DEMO_STORE'],
    ] as const) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain(marker);
    }
  });
});
