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
