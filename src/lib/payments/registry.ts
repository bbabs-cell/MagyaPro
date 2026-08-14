import type { PaymentProvider } from '@/lib/payments/types';
import {
  cashOnDeliveryProvider,
  payAtStoreProvider,
} from '@/lib/payments/providers/offline';
import {
  orangeMoneyProvider,
  waveProvider,
} from '@/lib/payments/providers/mobile-money';
import {
  orangeMoneyManualProvider,
  waveManualProvider,
} from '@/lib/payments/providers/manual-mobile-money';

/**
 * Registre des fournisseurs de paiement.
 *
 * Ajouter un fournisseur = l'implémenter puis l'ajouter à cette liste. Rien
 * d'autre à modifier dans l'application.
 */
const REGISTRY: PaymentProvider[] = [
  cashOnDeliveryProvider,
  payAtStoreProvider,
  orangeMoneyProvider,
  waveProvider,
  orangeMoneyManualProvider,
  waveManualProvider,
];

export function allProviders(): PaymentProvider[] {
  return REGISTRY;
}

export function getProvider(id: string): PaymentProvider | null {
  return REGISTRY.find((provider) => provider.id === id) ?? null;
}

/**
 * Fournisseurs réellement proposables à un client donné : configurés sur
 * l'instance, activés par le restaurant, et compatibles avec sa devise.
 */
export function availableProvidersFor(params: {
  enabledIds: string[];
  currency: string;
  fulfillmentType?: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
}): PaymentProvider[] {
  return REGISTRY.filter((provider) => {
    if (!params.enabledIds.includes(provider.id)) return false;
    if (!provider.isAvailable()) return false;
    if (
      provider.currencies.length > 0 &&
      !provider.currencies.includes(params.currency.toUpperCase())
    ) {
      return false;
    }

    // Les deux modes hors ligne sont liés au mode de retrait : proposer
    // « paiement à la livraison » n'a de sens que pour une livraison, et
    // « paiement sur place » que sans livreur (retrait ou table).
    if (
      (params.fulfillmentType === 'PICKUP' || params.fulfillmentType === 'DINE_IN') &&
      provider.id === 'cash_on_delivery'
    ) {
      return false;
    }
    if (params.fulfillmentType === 'DELIVERY' && provider.id === 'pay_at_store') {
      return false;
    }

    return true;
  });
}

/** Fournisseurs sélectionnables par un restaurateur dans ses réglages. */
export function configurableProviders(): Array<{
  id: string;
  label: string;
  description: string;
  available: boolean;
}> {
  return REGISTRY.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    available: provider.isAvailable(),
  }));
}
