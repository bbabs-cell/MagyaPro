import { describe, expect, it } from 'vitest';

import { RETENTION_DAYS } from '@/lib/retention';

/**
 * Durées de conservation.
 *
 * Ce test ne vérifie pas une mécanique, il verrouille une décision. La purge
 * efface des lignes en production, définitivement : le jour où quelqu'un
 * ramène le journal d'audit à trente jours pour gagner de la place, il doit
 * buter sur un test qui l'oblige à assumer le changement plutôt qu'à le
 * laisser passer dans un commit de nettoyage.
 */
describe('Durées de conservation', () => {
  it('garde le journal d’audit au moins deux ans', () => {
    // En dessous, un litige d'équipe ou un accès contesté ne peut plus être
    // instruit : c'est précisément à cela que sert ce journal.
    expect(RETENTION_DAYS.auditLog).toBeGreaterThanOrEqual(730);
  });

  it('garde une notification non lue plus longtemps qu’une notification lue', () => {
    // Une notification ouverte a rempli son office. Une notification jamais
    // ouverte a peut-être simplement été manquée.
    expect(RETENTION_DAYS.unreadNotification).toBeGreaterThan(RETENTION_DAYS.readNotification);
  });

  it('ne descend jamais sous un mois, quelle que soit la donnée', () => {
    for (const [key, days] of Object.entries(RETENTION_DAYS)) {
      expect(days, key).toBeGreaterThanOrEqual(30);
    }
  });
});
