import type { PaymentProvider } from '@/lib/payments/types';

/**
 * Orange Money — point d'extension déclaré, non implémenté.
 *
 * Contrairement à Wave (`wave-api.ts`), l'API Web Payment d'Orange Money
 * n'est pas documentée publiquement : ses spécifications précises (URL
 * d'authentification OAuth2, forme exacte des requêtes) ne sont accessibles
 * qu'après inscription sur Orange Partner. L'implémenter sans ces
 * spécifications reviendrait à deviner un contrat d'API financier — donc à
 * fabriquer une intégration invérifiable plutôt qu'à en construire une vraie.
 *
 * `isAvailable()` ne renvoie `true` que si les identifiants sont configurés,
 * ce qui n'arrivera jamais tant que `initiate()` n'a pas été écrit contre la
 * vraie documentation (obtenue via un compte partenaire Orange). Le moyen de
 * paiement reste alors absent du tunnel de commande — jamais un bouton qui ne
 * paie rien.
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
