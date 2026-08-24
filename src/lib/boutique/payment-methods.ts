import { prisma } from '@/lib/db';

/**
 * Moyens de paiement d'une boutique — configurables (`StorePaymentMethod`),
 * jamais codés en dur dans la caisse. Une boutique qui n'a encore rien
 * configuré (le cas de toutes les boutiques créées avant cette
 * fonctionnalité) reçoit cette liste par défaut, jusqu'à ce qu'elle la
 * personnalise depuis Réglages — jamais une liste vide qui bloquerait la
 * caisse.
 */
export const DEFAULT_PAYMENT_METHODS: Array<{ method: string; label: string }> = [
  { method: 'cash', label: 'Espèces' },
  { method: 'orange_money', label: 'Orange Money' },
  { method: 'moov_money', label: 'Moov Money' },
  { method: 'card', label: 'Carte' },
  { method: 'wave', label: 'Wave' },
];

export type StorePaymentMethodRow = {
  id: string;
  method: string;
  label: string;
  isEnabled: boolean;
  position: number;
};

/**
 * Moyens de paiement actifs d'une boutique, prêts pour la caisse. Sème les
 * valeurs par défaut au premier appel si la boutique n'a encore rien
 * configuré — une seule fois, la table fait ensuite foi.
 */
export async function getEnabledPaymentMethods(storeId: string): Promise<StorePaymentMethodRow[]> {
  const existing = await prisma.storePaymentMethod.findMany({
    where: { storeId },
    orderBy: { position: 'asc' },
  });

  if (existing.length === 0) {
    const seeded = await prisma.$transaction(
      DEFAULT_PAYMENT_METHODS.map((entry, position) =>
        prisma.storePaymentMethod.create({ data: { storeId, ...entry, position } }),
      ),
    );
    return seeded;
  }

  return existing.filter((m) => m.isEnabled);
}
