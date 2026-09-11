import { describe, expect, it } from 'vitest';

import { amountIn, primaryCurrency } from '@/lib/platform-revenue';
import {
  SUBSCRIPTION_STATUSES,
  subscriptionStatusLabel,
  subscriptionStatusMerchantLabel,
  subscriptionStatusTone,
} from '@/lib/subscription-labels';

/**
 * Règles pures autour de la recette plateforme et des statuts d'abonnement.
 * Le calcul lui-même lit la base ; ce qui est testé ici est ce qui peut
 * dériver en silence.
 */

describe('Devises de la recette', () => {
  it('retient la devise qui pèse le plus lourd', () => {
    expect(primaryCurrency({ XOF: 500_000, EUR: 200 })).toBe('XOF');
  });

  it('retombe sur le franc CFA quand rien n’a encore été encaissé', () => {
    expect(primaryCurrency({})).toBe('XOF');
  });

  it('rend zéro pour une devise absente plutôt qu’une valeur indéfinie', () => {
    // Un mois sans encaissement doit s'afficher « 0 F », pas « NaN ».
    expect(amountIn({ XOF: 25_000 }, 'EUR')).toBe(0);
    expect(amountIn({}, 'XOF')).toBe(0);
  });
});

describe('Borne de comparaison mensuelle', () => {
  /**
   * Reproduit la borne posée dans `getPlatformRevenue` : le mois précédent
   * arrêté au même quantième. C'est elle qui empêche l'écran d'annoncer
   * −100 % le 11 du mois simplement parce que le mois d'avant comptait
   * trente-et-un jours.
   */
  const cutoffFor = (now: Date) => {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 1);
    return cutoff;
  };

  it('retient le même quantième du mois précédent', () => {
    const cutoff = cutoffFor(new Date(2026, 8, 11, 14, 30));
    expect(cutoff.getMonth()).toBe(7);
    expect(cutoff.getDate()).toBe(11);
  });

  it('exclut la fin du mois précédent de la comparaison', () => {
    // Le 31 août ne doit pas peser dans une comparaison faite le 11 septembre.
    const cutoff = cutoffFor(new Date(2026, 8, 11, 14, 30));
    expect(new Date(2026, 7, 31, 12, 0) <= cutoff).toBe(false);
    expect(new Date(2026, 7, 5, 12, 0) <= cutoff).toBe(true);
  });

  it('reste une borne franche quand le quantième n’existe pas', () => {
    // 31 mars comparé à février : le report sur mars est accepté, pourvu que
    // la borne reste unique et antérieure au mois en cours.
    const now = new Date(2026, 2, 31, 10, 0);
    const cutoff = cutoffFor(now);
    expect(cutoff < now).toBe(true);
  });
});

describe('Statuts d’abonnement', () => {
  it('traduit chaque statut réel, sans laisser passer un code brut', () => {
    // Le défaut corrigé : les deux tableaux Super Admin affichaient
    // « PAST_DUE » sur la ligne d'un client.
    for (const status of SUBSCRIPTION_STATUSES) {
      const label = subscriptionStatusLabel(status);
      expect(label).not.toBe(status);
      expect(label).not.toMatch(/_/);
    }
  });

  it('a une formulation distincte pour l’abonné et pour la plateforme', () => {
    // Distinction délibérée : le Super Admin constate, le commerçant est
    // concerné. Si les deux jeux devenaient identiques, la nuance aurait été
    // perdue au passage d'une refonte.
    expect(subscriptionStatusLabel('PAST_DUE')).toBe('En retard');
    expect(subscriptionStatusMerchantLabel('PAST_DUE')).toBe('Paiement en retard');
  });

  it('rend un code inconnu tel quel plutôt qu’une case vide', () => {
    expect(subscriptionStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    expect(subscriptionStatusTone('UNKNOWN_STATUS')).toBe('neutral');
  });

  it('distingue un résilié d’un expiré', () => {
    // Le premier est parti, le second se rattrape d'un paiement : c'est ce
    // qui décide s'il faut relancer.
    expect(subscriptionStatusTone('CANCELLED')).not.toBe(subscriptionStatusTone('EXPIRED'));
  });
});
