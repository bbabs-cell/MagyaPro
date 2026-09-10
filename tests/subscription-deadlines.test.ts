import { describe, expect, it } from 'vitest';

import { daysUntil, deadlineLabel, isDeadlineFilter } from '@/lib/admin/subscriptions-list';

/**
 * Calcul d'échéance des abonnements — la règle qui décide de la couleur d'une
 * ligne et de la présence d'un client dans la liste de relance.
 */

describe('Jours restants avant échéance', () => {
  it('compte en jours de calendrier, pas en heures', () => {
    // Le défaut évité : une échéance ce soir à 23 h et une demain à 1 h ne sont
    // séparées que de deux heures, mais ce sont bien deux jours différents.
    const ceSoir = new Date(2026, 8, 10, 23, 0);
    const demainMatin = new Date(2026, 8, 11, 1, 0);
    const maintenant = new Date(2026, 8, 10, 21, 0);

    expect(daysUntil(ceSoir, maintenant)).toBe(0);
    expect(daysUntil(demainMatin, maintenant)).toBe(1);
  });

  it('rend un nombre négatif pour une échéance passée', () => {
    const passee = new Date(2026, 8, 7, 12, 0);
    expect(daysUntil(passee, new Date(2026, 8, 10, 9, 0))).toBe(-3);
  });

  it('ne dépend pas de l’heure de consultation', () => {
    // La page fige la date côté serveur ; le calcul doit rendre la même valeur
    // qu'on la consulte au petit matin ou en fin de journée.
    const echeance = new Date(2026, 8, 15, 12, 0);
    expect(daysUntil(echeance, new Date(2026, 8, 10, 6, 0))).toBe(
      daysUntil(echeance, new Date(2026, 8, 10, 22, 0)),
    );
  });
});

describe('Formulation de l’échéance', () => {
  it('nomme les cas proches en clair plutôt qu’en nombre de jours', () => {
    expect(deadlineLabel(0)).toBe("se termine aujourd'hui");
    expect(deadlineLabel(1)).toBe('se termine demain');
    expect(deadlineLabel(5)).toBe('dans 5 jours');
  });

  it('dit de combien une échéance est dépassée, au singulier comme au pluriel', () => {
    expect(deadlineLabel(-1)).toBe('dépassée de 1 jour');
    expect(deadlineLabel(-4)).toBe('dépassée de 4 jours');
  });
});

describe('Filtre de relance', () => {
  it('n’accepte que les deux valeurs connues', () => {
    // Le filtre vient de l'URL : une valeur inventée doit être ignorée, pas
    // produire une clause de recherche vide qui laisserait tout passer.
    expect(isDeadlineFilter('soon')).toBe(true);
    expect(isDeadlineFilter('overdue')).toBe(true);
    expect(isDeadlineFilter('bientot')).toBe(false);
    expect(isDeadlineFilter('')).toBe(false);
  });
});
