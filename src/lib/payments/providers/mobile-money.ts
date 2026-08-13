import type { PaymentProvider } from '@/lib/payments/types';

/**
 * Fournisseurs mobile money — points d'extension déclarés, non implémentés.
 *
 * Ces objets existent pour que l'architecture soit prête, mais `isAvailable()`
 * ne renvoie `true` que lorsque les identifiants d'API sont réellement
 * configurés. Tant qu'ils ne le sont pas, le moyen de paiement n'apparaît pas
 * dans le tunnel de commande, et `initiate()` lève une erreur explicite plutôt
 * que de faire semblant d'encaisser.
 *
 * Pour brancher un fournisseur :
 *   1. renseigner les variables d'environnement listées dans `.env.example` ;
 *   2. remplacer le corps de `initiate()` par l'appel à l'API du fournisseur ;
 *   3. ajouter la route de webhook correspondante sous
 *      `src/app/api/webhooks/paiements/<fournisseur>/route.ts`, qui appellera
 *      `applyPaymentStatus()` (voir `src/lib/payments/service.ts`).
 */

function notConfigured(name: string): never {
  throw new Error(
    `Le fournisseur de paiement « ${name} » n'est pas configuré sur cette instance.`,
  );
}

export const orangeMoneyProvider: PaymentProvider = {
  id: 'orange_money',
  label: 'Orange Money',
  description: 'Paiement mobile Orange Money.',
  currencies: ['XOF', 'XAF'],
  isAvailable: () =>
    Boolean(process.env.ORANGE_MONEY_API_KEY && process.env.ORANGE_MONEY_MERCHANT_ID),
  async initiate() {
    return notConfigured('Orange Money');
  },
};

export const waveProvider: PaymentProvider = {
  id: 'wave',
  label: 'Wave',
  description: 'Paiement mobile Wave.',
  currencies: ['XOF'],
  isAvailable: () => Boolean(process.env.WAVE_API_KEY),
  async initiate() {
    return notConfigured('Wave');
  },
};
