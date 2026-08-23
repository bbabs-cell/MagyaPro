import { prisma } from '@/lib/db';
import { PlanLimitError } from '@/lib/errors';

/**
 * Droits accordés par l'abonnement Boutique — même principe que
 * `src/lib/entitlements.ts` (Restaurant), fichier séparé et volontairement
 * plus restreint : seules les options réellement gateables aujourd'hui y
 * figurent (pas de fonctionnalité « avancée » sans contenu réel derrière,
 * pas de limite sur une ressource qu'aucune route ne crée encore).
 *
 * `Plan.product` distingue désormais les plans Restaurant des plans
 * Boutique dans la même table — les deux catalogues ne se mélangent jamais
 * dans une requête ou une interface.
 */

export const STORE_FEATURES = {
  MULTIPLE_USERS: 'multiple_users',
  CUSTOM_DOMAIN: 'custom_domain',
} as const;

export type StoreFeature = (typeof STORE_FEATURES)[keyof typeof STORE_FEATURES];

export const STORE_FEATURE_LABELS: Record<StoreFeature, string> = {
  multiple_users: 'Plusieurs comptes utilisateurs',
  custom_domain: 'Nom de domaine personnalisé',
};

export type StorePlanLimits = {
  maxProducts?: number;
  maxUsers?: number;
};

export const STORE_LIMIT_LABELS: Record<keyof StorePlanLimits, string> = {
  maxProducts: 'Produits',
  maxUsers: 'Utilisateurs',
};

export type StoreEntitlements = {
  planKey: string | null;
  planName: string;
  status: string;
  features: Set<string>;
  limits: StorePlanLimits;
  /** Faux quand l'abonnement est expiré/annulé : les écritures sont bloquées. */
  isActive: boolean;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
};

/** Abonnement sans plan : une boutique tout juste créée. Accès en lecture, aucune option payante. */
const NO_PLAN: StoreEntitlements = {
  planKey: null,
  planName: 'Aucun plan',
  status: 'EXPIRED',
  features: new Set(),
  limits: { maxProducts: 20, maxUsers: 1 },
  isActive: false,
  currentPeriodEnd: null,
  trialEndsAt: null,
  graceEndsAt: null,
};

export async function getStoreEntitlements(storeId: string): Promise<StoreEntitlements> {
  const subscription = await prisma.storeSubscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });

  if (!subscription) return NO_PLAN;

  const periodElapsed = subscription.currentPeriodEnd.getTime() < Date.now();
  const isActive =
    (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') && !periodElapsed;

  return {
    planKey: subscription.plan.key,
    planName: subscription.plan.name,
    status: periodElapsed && isActiveStatus(subscription.status) ? 'EXPIRED' : subscription.status,
    features: new Set(subscription.plan.features),
    limits: (subscription.plan.limits ?? {}) as StorePlanLimits,
    isActive,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    graceEndsAt: subscription.graceEndsAt,
  };
}

function isActiveStatus(status: string): boolean {
  return status === 'ACTIVE' || status === 'TRIALING';
}

export function hasStoreFeature(entitlements: StoreEntitlements, feature: StoreFeature): boolean {
  return entitlements.isActive && entitlements.features.has(feature);
}

/** Lève une erreur 402 exploitable par l'interface si l'option manque. */
export function requireStoreFeature(entitlements: StoreEntitlements, feature: StoreFeature): void {
  if (!entitlements.isActive) {
    throw new PlanLimitError(
      "Votre abonnement n'est plus actif. Réactivez-le pour utiliser cette fonctionnalité.",
    );
  }
  if (!entitlements.features.has(feature)) {
    throw new PlanLimitError(
      `« ${STORE_FEATURE_LABELS[feature]} » n'est pas incluse dans le plan ${entitlements.planName}. Changez de plan pour y accéder.`,
    );
  }
}

/** Vérifie une limite quantitative avant création, côté serveur, juste avant l'insertion. */
export async function requireStoreWithinLimit(
  storeId: string,
  limit: keyof StorePlanLimits,
  entitlements?: StoreEntitlements,
): Promise<void> {
  const ent = entitlements ?? (await getStoreEntitlements(storeId));
  const max = ent.limits[limit];
  if (max === undefined || max < 0) return; // pas de limite définie

  const current = await countForLimit(storeId, limit);
  if (current >= max) {
    throw new PlanLimitError(
      `Votre plan ${ent.planName} est limité à ${max} ${STORE_LIMIT_LABELS[limit].toLowerCase()}. Passez à un plan supérieur pour en ajouter.`,
    );
  }
}

async function countForLimit(storeId: string, limit: keyof StorePlanLimits): Promise<number> {
  switch (limit) {
    case 'maxProducts':
      return prisma.storeProduct.count({ where: { storeId } });
    case 'maxUsers':
      return prisma.storeUser.count({ where: { storeId } });
  }
}
