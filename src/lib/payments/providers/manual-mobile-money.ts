import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import type { PaymentProvider } from '@/lib/payments/types';

/**
 * Paiement mobile money — voie manuelle, réellement fonctionnelle dès
 * aujourd'hui.
 *
 * Contrairement aux fournisseurs API (`orange_money`, `wave`), ceux-ci ne
 * demandent aucun identifiant de développeur : le client envoie lui-même le
 * montant depuis son application Orange Money ou Wave vers le numéro du
 * restaurant, dépose une capture d'écran comme preuve, et le restaurant
 * valide la réception depuis son dashboard. C'est le même principe que le
 * paiement à la livraison ou au comptoir : l'encaissement a réellement lieu,
 * simplement hors du système de paiement.
 */

function manualMobileMoneyProvider(params: {
  id: string;
  label: string;
  /** Nom du service seul, pour les phrases (« sur le numéro Wave du restaurant »). */
  shortLabel: string;
  currencies: string[];
  numberField: 'orangeMoneyNumber' | 'waveNumber';
}): PaymentProvider {
  return {
    id: params.id,
    label: params.label,
    description: `Vous envoyez le montant sur le numéro ${params.shortLabel} du restaurant, puis déposez une preuve de paiement.`,
    currencies: params.currencies,
    isAvailable: () => true,
    async initiate(intent) {
      const settings = await prisma.restaurantSettings.findUnique({
        where: { restaurantId: intent.restaurantId },
        select: { orangeMoneyNumber: true, waveNumber: true },
      });
      const receivingNumber = settings?.[params.numberField];
      if (!receivingNumber) {
        throw new Error(`Numéro ${params.shortLabel} non configuré par le restaurant.`);
      }

      return {
        status: 'PENDING',
        instructions: `Envoyez ${formatMoney(intent.amount, intent.currency)} au ${receivingNumber} (${params.shortLabel}), puis déposez votre preuve de paiement sur cette page.`,
        metadata: { receivingNumber },
      };
    },
  };
}

export const orangeMoneyManualProvider = manualMobileMoneyProvider({
  id: 'orange_money_manual',
  label: 'Orange Money (dépôt manuel)',
  shortLabel: 'Orange Money',
  currencies: ['XOF', 'XAF'],
  numberField: 'orangeMoneyNumber',
});

export const waveManualProvider = manualMobileMoneyProvider({
  id: 'wave_manual',
  label: 'Wave (dépôt manuel)',
  shortLabel: 'Wave',
  currencies: ['XOF'],
  numberField: 'waveNumber',
});
