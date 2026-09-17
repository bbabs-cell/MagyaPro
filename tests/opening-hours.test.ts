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
 * Raccourci pour les tests qui ne portent **pas** sur l'état d'ouverture
 * lui-même — libellés, langue, gabarits — et auxquels le fuseau est donc
 * indifférent.
 *
 * Cette ligne affirmait auparavant que `Etc/GMT-14` et `Etc/GMT+11` sont, à
 * toute heure UTC, l'un en journée et l'autre non. C'est faux : à midi UTC
 * les deux sont hors de la plage 9 h–17 h. Un test s'appuyait sur cette
 * affirmation et échouait selon l'heure de lancement ; il calcule désormais
 * ses fuseaux (voir plus bas).
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
    /**
     * Ce test choisissait deux fuseaux fixes distants de 25 heures, en
     * supposant qu'ils ne pouvaient pas être dans le même état. C'était faux :
     * lancé à 12 h UTC, il les trouve tous deux hors de la plage 9 h–17 h,
     * fermés avec le même libellé — et il échouait, sans qu'aucun défaut
     * n'existe. Un test qui dépend de l'heure à laquelle on le lance ne
     * mesure rien de fiable.
     *
     * Les deux fuseaux sont donc calculés à partir de l'heure UTC courante,
     * pour placer l'un en pleine journée et l'autre en pleine nuit. Les
     * horaires couvrent les sept jours, afin que le quantième local — qui
     * change lui aussi d'un fuseau à l'autre — n'entre pas en jeu.
     */
    const everyDay: OpeningHourRow[] = Array.from({ length: 7 }, (_, day) => ({
      dayOfWeek: day,
      isClosed: false,
      opensAt: '09:00',
      closesAt: '17:00',
    }));

    const utcHour = new Date().getUTCHours();
    // `Etc/GMT+N` est décalé de **moins** N heures : le signe est inversé.
    const zoneAt = (localHour: number) => {
      const offset = ((localHour - utcHour) % 24 + 24) % 24;
      const shift = offset > 12 ? offset - 24 : offset;
      return `Etc/GMT${shift >= 0 ? '-' : '+'}${Math.abs(shift)}`;
    };

    const midday = computeOpenState(everyDay, zoneAt(12), FR, 'fr');
    const midnight = computeOpenState(everyDay, zoneAt(0), FR, 'fr');

    expect(midday.isOpen).toBe(true);
    expect(midnight.isOpen).toBe(false);
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
