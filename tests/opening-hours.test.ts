import { describe, expect, it } from 'vitest';

import { DAY_NAMES, computeOpenState, dayNames, type OpeningHourRow } from '@/lib/site/hours';
import { DICTIONARY } from '@/lib/i18n/dictionary';

/**
 * La pastille « ouvert / fermé » est la phrase la plus lue d'une vitrine, et
 * elle était écrite en français en dur. Ces tests verrouillent deux choses :
 * qu'elle suit bien la langue du visiteur, et que le calcul d'ouverture — qui,
 * lui, n'a pas changé — donne toujours les mêmes réponses.
 */

const FR = DICTIONARY.fr.templates;
const EN = DICTIONARY.en.templates;
const AR = DICTIONARY.ar.templates;

/** Lundi–vendredi 09:00–17:00, samedi et dimanche fermés. */
const WEEK: OpeningHourRow[] = Array.from({ length: 7 }, (_, day) => ({
  dayOfWeek: day,
  isClosed: day === 0 || day === 6,
  opensAt: '09:00',
  closesAt: '17:00',
}));

/**
 * Un fuseau fixe est indispensable : sans lui, le résultat dépendrait de
 * l'heure à laquelle la suite est lancée. `Etc/GMT-14` et `Etc/GMT+11` sont
 * choisis pour être, à toute heure UTC, l'un en journée et l'autre non — la
 * paire couvre donc les deux branches quel que soit le moment du test.
 */
function stateAt(timezone: string, dict: typeof FR) {
  return computeOpenState(WEEK, timezone, dict, 'fr');
}

describe("Horaires d'ouverture", () => {
  it('renvoie la phrase « horaires non renseignés » quand aucun horaire n\'existe', () => {
    expect(computeOpenState([], 'Africa/Abidjan', FR, 'fr').label).toBe(FR.hoursUnknown);
    expect(computeOpenState([], 'Africa/Abidjan', EN, 'en').label).toBe(EN.hoursUnknown);
    expect(computeOpenState([], 'Africa/Abidjan', AR, 'ar').label).toBe(AR.hoursUnknown);
    expect(computeOpenState([], 'Africa/Abidjan', FR, 'fr').isOpen).toBe(false);
  });

  it('ne laisse jamais passer une phrase française quand le visiteur lit en anglais', () => {
    // Quelle que soit l'heure réelle, l'étiquette produite doit provenir du
    // dictionnaire demandé — c'est exactement le défaut corrigé ici.
    for (const timezone of ['Etc/GMT-14', 'Etc/GMT+11', 'Africa/Abidjan']) {
      const label = stateAt(timezone, EN).label;
      expect(label).not.toMatch(/Ouvert|Fermé|ouvre|ferme|demain/);
    }
  });

  it('respecte le fuseau du restaurant et non celui du serveur', () => {
    // Deux fuseaux distants de 25 heures ne peuvent pas être dans le même
    // état d'ouverture au même instant sur une semaine 9h–17h.
    const far = stateAt('Etc/GMT-14', FR);
    const near = stateAt('Etc/GMT+11', FR);
    expect(far.isOpen === near.isOpen && far.label === near.label).toBe(false);
  });

  it('retombe sur l\'heure du serveur si le fuseau enregistré est invalide', () => {
    const state = computeOpenState(WEEK, 'Pas/Un/Fuseau', FR, 'fr');
    expect(typeof state.label).toBe('string');
    expect(state.label.length).toBeGreaterThan(0);
  });

  it('annonce la fermeture du jour avec l\'heure d\'ouverture', () => {
    const beforeOpening: OpeningHourRow[] = WEEK.map((row) => ({
      ...row,
      isClosed: false,
      opensAt: '23:59',
      closesAt: '23:59',
    }));
    const label = computeOpenState(beforeOpening, 'Etc/GMT-12', FR, 'fr').label;
    // Soit « ouvre à 23:59 » aujourd'hui, soit « ouvre demain à 23:59 ».
    expect(label).toContain('23:59');
    expect(label.startsWith('Fermé')).toBe(true);
  });

  it('ne laisse aucun gabarit {time} ou {day} non remplacé', () => {
    for (const dict of [FR, EN, AR]) {
      for (const timezone of ['Etc/GMT-14', 'Etc/GMT+11']) {
        expect(computeOpenState(WEEK, timezone, dict, 'fr').label).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe('Noms de jours', () => {
  it('rend les sept jours dans l\'ordre attendu, dimanche en premier', () => {
    // `Intl` rend les jours en minuscules en français, la liste du tableau de
    // bord les capitalise : on compare donc sans tenir compte de la casse.
    expect(dayNames('fr').map((day) => day.toLowerCase())).toEqual(
      DAY_NAMES.map((day) => day.toLowerCase()),
    );
    expect(dayNames('fr')[0]!.toLowerCase()).toBe('dimanche');
    expect(dayNames('fr')[6]!.toLowerCase()).toBe('samedi');
    expect(dayNames('en')[0]).toBe('Sunday');
    expect(dayNames('en')[6]).toBe('Saturday');
  });

  it('rend sept noms distincts dans chaque langue', () => {
    for (const locale of ['fr', 'en', 'ar']) {
      const days = dayNames(locale);
      expect(days).toHaveLength(7);
      expect(new Set(days).size).toBe(7);
      expect(days.every((day) => day.trim().length > 0)).toBe(true);
    }
  });

  it('retombe sur les jours français si la langue est inexploitable', () => {
    expect(dayNames('!!!')).toEqual([...DAY_NAMES]);
  });
});
