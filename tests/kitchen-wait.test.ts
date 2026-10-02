import { describe, expect, it } from 'vitest';

import { formatWait } from '@/lib/orders/wait';

/**
 * L'écran de cuisine se lit de loin. Une attente doit dire son ordre de
 * grandeur par son unité, avant même qu'on lise le nombre — « 22908 min »,
 * que l'écran affichait pour une commande ouverte depuis seize jours, ne dit
 * rien à personne.
 */
describe('formatWait', () => {
  it('garde les minutes sous l’heure', () => {
    expect(formatWait(0)).toBe('0 min');
    expect(formatWait(14)).toBe('14 min');
    expect(formatWait(59)).toBe('59 min');
  });

  it('passe aux heures, minutes sur deux chiffres', () => {
    expect(formatWait(60)).toBe('1 h 00');
    expect(formatWait(125)).toBe('2 h 05');
    expect(formatWait(23 * 60 + 59)).toBe('23 h 59');
  });

  it('passe aux jours au-delà de vingt-quatre heures', () => {
    expect(formatWait(24 * 60)).toBe('1 j');
    expect(formatWait(22908)).toBe('15 j');
  });

  it('ne rend jamais une attente négative ni fractionnaire', () => {
    expect(formatWait(-5)).toBe('0 min');
    expect(formatWait(12.9)).toBe('12 min');
  });
});
