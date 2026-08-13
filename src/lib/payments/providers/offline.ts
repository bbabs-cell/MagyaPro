import type { PaymentProvider } from '@/lib/payments/types';

/**
 * Paiements hors ligne : à la livraison et sur place.
 *
 * Ce ne sont pas des fournisseurs « factices ». L'encaissement a réellement
 * lieu, simplement en espèces, hors du système. Le paiement reste donc
 * `PENDING` jusqu'à ce que le restaurant le marque encaissé depuis son
 * dashboard — ce qui reflète fidèlement la réalité, contrairement à un
 * paiement marqué « payé » d'office.
 */

export const cashOnDeliveryProvider: PaymentProvider = {
  id: 'cash_on_delivery',
  label: 'Paiement à la livraison',
  description: 'Le client règle en espèces au moment de la livraison.',
  currencies: [],
  isAvailable: () => true,
  async initiate() {
    return {
      status: 'PENDING',
      instructions:
        'Réglez votre commande en espèces au livreur. Préparez l\'appoint si possible.',
    };
  },
};

export const payAtStoreProvider: PaymentProvider = {
  id: 'pay_at_store',
  label: 'Paiement sur place',
  description: 'Le client règle au comptoir lors du retrait.',
  currencies: [],
  isAvailable: () => true,
  async initiate() {
    return {
      status: 'PENDING',
      instructions: 'Réglez votre commande au comptoir lors du retrait.',
    };
  },
};
