import { prisma } from '@/lib/db';
import { getPlatformSettings } from '@/lib/platform-settings';

/**
 * Tarification des boutiques d'un même compte.
 *
 * Un commerçant peut ouvrir plusieurs boutiques. Chacune garde son propre
 * abonnement, son propre stock et sa propre équipe : ce module ne s'occupe
 * que du montant à payer.
 *
 * La règle : la première boutique d'un compte paie le tarif du plan, chaque
 * boutique suivante en paie un pourcentage. À 75 %, un compte Premium
 * (25 000) paie 25 000 pour la première boutique et 18 750 par boutique
 * supplémentaire, soit 43 750 pour deux.
 *
 * La majoration est linéaire et non composée : la troisième boutique coûte le
 * même supplément que la deuxième. Un commerçant qui ouvre trois échoppes sur
 * le même marché ne doit pas voir sa facture exploser.
 *
 * Le pourcentage vient des réglages de plateforme, jamais d'une constante :
 * un tarif ne s'écrit pas dans le code (voir `Plan.price`), et le faire
 * évoluer ne doit pas demander un déploiement. La constante ci-dessous n'est
 * qu'un filet quand la ligne de réglages n'existe pas encore.
 */

/** Valeur de repli tant qu'aucune ligne `platform_settings` n'existe. */
export const DEFAULT_ADDITIONAL_STORE_PERCENT = 75;

export type StoreBillingPosition = {
  /** Rang de la boutique dans le groupe de son propriétaire, à partir de 1. */
  rank: number;
  /** Nombre de boutiques facturables du groupe. */
  groupSize: number;
  /** Vrai dès le rang 2 : cette boutique est facturée au tarif majoré. */
  isAdditional: boolean;
};

/**
 * Place d'une boutique dans le groupe de facturation de son propriétaire.
 *
 * Le groupe est défini par `Store.ownerAccountId`, pas par les adhésions
 * `StoreUser` : une boutique peut avoir plusieurs propriétaires et une équipe
 * qui change, alors que le rattachement de facturation doit rester stable.
 *
 * Les boutiques de démonstration sont exclues du décompte — elles ne sont
 * jamais facturées, et les inclure ferait payer une majoration au compte de
 * démonstration.
 *
 * Si la boutique la plus ancienne du groupe est supprimée, la suivante prend
 * le rang 1 et repasse au tarif plein. C'est voulu : un compte paie toujours
 * au moins un abonnement complet.
 */
export async function getStoreBillingPosition(storeId: string): Promise<StoreBillingPosition> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerAccountId: true, createdAt: true, isDemo: true },
  });

  // Boutique inconnue, de démonstration, ou sans compte propriétaire (créée
  // avant l'introduction du groupe et non rattrapée) : tarif plein. En cas de
  // doute sur le rattachement, on ne facture pas de majoration.
  if (!store || store.isDemo || !store.ownerAccountId) {
    return { rank: 1, groupSize: 1, isAdditional: false };
  }

  const [older, groupSize] = await Promise.all([
    prisma.store.count({
      where: {
        ownerAccountId: store.ownerAccountId,
        isDemo: false,
        createdAt: { lt: store.createdAt },
      },
    }),
    prisma.store.count({
      where: { ownerAccountId: store.ownerAccountId, isDemo: false },
    }),
  ]);

  const rank = older + 1;
  return { rank, groupSize, isAdditional: rank > 1 };
}

/** Majoration en vigueur, en pourcentage du tarif du plan. */
export async function getAdditionalStorePercent(): Promise<number> {
  const settings = await getPlatformSettings();
  return settings?.additionalStorePercent ?? DEFAULT_ADDITIONAL_STORE_PERCENT;
}

/**
 * Montant dû pour une boutique supplémentaire, arrondi à l'unité mineure.
 * Fonction pure : c'est elle qui définit la règle, tout le reste l'appelle.
 */
export function additionalStorePrice(planPrice: number, percent: number): number {
  return Math.round((planPrice * percent) / 100);
}

export type StoreSubscriptionPrice = {
  /** Tarif du plan, sans majoration. */
  planPrice: number;
  /** Montant réellement dû pour cette boutique. */
  amount: number;
  /** Pourcentage appliqué, `null` pour la première boutique du compte. */
  percent: number | null;
  position: StoreBillingPosition;
};

/**
 * Montant dû par une boutique pour un plan donné, majoration comprise.
 *
 * Appelé à chaque demande de paiement, y compris au renouvellement : sans
 * cela, une boutique supplémentaire repasserait au tarif plein le mois
 * suivant.
 *
 * La remise promotionnelle n'est pas appliquée ici. Elle vient après, sur ce
 * montant, et seulement au premier paiement d'une boutique — voir
 * `createStoreSubscriptionPaymentRequest`.
 */
export async function getStoreSubscriptionPrice(
  storeId: string,
  planPrice: number,
): Promise<StoreSubscriptionPrice> {
  const position = await getStoreBillingPosition(storeId);
  if (!position.isAdditional) {
    return { planPrice, amount: planPrice, percent: null, position };
  }

  const percent = await getAdditionalStorePercent();
  return {
    planPrice,
    amount: additionalStorePrice(planPrice, percent),
    percent,
    position,
  };
}

/**
 * Plan que doit suivre une boutique supplémentaire.
 *
 * Toutes les boutiques d'un compte partagent le même plan : sans cette règle,
 * « 75 % de quoi ? » n'aurait pas de réponse quand la première boutique est en
 * Pro et la deuxième en Premium. La boutique de rang 1 fait référence.
 *
 * Retourne `null` pour la première boutique du groupe, qui choisit librement,
 * et pour un groupe dont la boutique de référence n'a pas encore de plan.
 */
export async function getGroupPlanKey(storeId: string): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerAccountId: true, createdAt: true, isDemo: true },
  });
  if (!store || store.isDemo || !store.ownerAccountId) return null;

  const reference = await prisma.store.findFirst({
    where: { ownerAccountId: store.ownerAccountId, isDemo: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, subscription: { select: { plan: { select: { key: true } } } } },
  });

  if (!reference || reference.id === storeId) return null;
  return reference.subscription?.plan.key ?? null;
}
