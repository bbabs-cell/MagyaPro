import { cache } from 'react';

import { prisma } from '@/lib/db';
import { PlanLimitError } from '@/lib/errors';

/**
 * Droits accordés par l'abonnement.
 *
 * Point de contrôle unique : Subscription → Plan → features/limits → accès.
 * Le frontend peut masquer une option payante pour le confort visuel, mais
 * c'est ce module, appelé côté serveur, qui décide réellement.
 *
 * Les plans sont des *données* (table `plans`), jamais des constantes : un prix
 * ou une limite se change en base, sans redéploiement.
 */

export const FEATURES = {
  CUSTOM_DOMAIN: 'custom_domain',
  PROMOTIONS: 'promotions',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  MULTIPLE_USERS: 'multiple_users',
  PREMIUM_TEMPLATES: 'premium_templates',
  REMOVE_BRANDING: 'remove_branding',
  REVIEWS: 'reviews',
  RESERVATIONS: 'reservations',
  TABLE_SERVICE: 'table_service',
  LOYALTY: 'loyalty',
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_LABELS: Record<Feature, string> = {
  custom_domain: 'Nom de domaine personnalisé',
  promotions: 'Codes promotionnels',
  advanced_analytics: 'Statistiques avancées',
  multiple_users: 'Plusieurs comptes utilisateurs',
  premium_templates: 'Templates premium',
  remove_branding: 'Retirer la mention « Propulsé par Magyapro »',
  reviews: 'Avis clients',
  reservations: 'Réservations de table',
  table_service: 'Service à table (QR code)',
  loyalty: 'Programme de fidélité',
};

export type PlanLimits = {
  maxProducts?: number;
  maxCategories?: number;
  maxUsers?: number;
  maxOrdersPerMonth?: number;
};

export const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  maxProducts: 'Produits',
  maxCategories: 'Catégories',
  maxUsers: 'Utilisateurs',
  maxOrdersPerMonth: 'Commandes par mois',
};

export type Entitlements = {
  planKey: string | null;
  planName: string;
  status: string;
  features: Set<string>;
  limits: PlanLimits;
  /** Faux quand l'abonnement est expiré/annulé : les écritures sont bloquées. */
  isActive: boolean;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  /** Fin du délai de grâce de 3 jours, si l'abonnement est `PAST_DUE`. */
  graceEndsAt: Date | null;
};

/**
 * Abonnement sans plan : un restaurant tout juste créé, ou dont l'abonnement a
 * été supprimé. Il conserve un accès en lecture, aucune option payante.
 */
const NO_PLAN: Entitlements = {
  planKey: null,
  planName: 'Aucun plan',
  status: 'EXPIRED',
  features: new Set(),
  limits: { maxProducts: 10, maxCategories: 3, maxUsers: 1 },
  isActive: false,
  currentPeriodEnd: null,
  trialEndsAt: null,
  graceEndsAt: null,
};

export const getEntitlements = cache(async (
  restaurantId: string,
): Promise<Entitlements> => {
  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true },
  });

  if (!subscription) return NO_PLAN;

  // Un abonnement dont la période est écoulée n'est plus actif, même si son
  // statut n'a pas encore été mis à jour par la tâche de facturation.
  const periodElapsed = subscription.currentPeriodEnd.getTime() < Date.now();
  const isActive =
    (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') &&
    !periodElapsed;

  return {
    planKey: subscription.plan.key,
    planName: subscription.plan.name,
    status: periodElapsed && isActiveStatus(subscription.status)
      ? 'EXPIRED'
      : subscription.status,
    features: new Set(subscription.plan.features),
    limits: (subscription.plan.limits ?? {}) as PlanLimits,
    isActive,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    graceEndsAt: subscription.graceEndsAt,
  };
});

function isActiveStatus(status: string): boolean {
  return status === 'ACTIVE' || status === 'TRIALING';
}

export function hasFeature(
  entitlements: Entitlements,
  feature: Feature,
): boolean {
  return entitlements.isActive && entitlements.features.has(feature);
}

/** Lève une erreur 402 exploitable par l'interface si l'option manque. */
export function requireFeature(
  entitlements: Entitlements,
  feature: Feature,
): void {
  if (!entitlements.isActive) {
    throw new PlanLimitError(
      "Votre abonnement n'est plus actif. Réactivez-le pour utiliser cette fonctionnalité.",
    );
  }
  if (!entitlements.features.has(feature)) {
    throw new PlanLimitError(
      `« ${FEATURE_LABELS[feature]} » n'est pas incluse dans le plan ${entitlements.planName}. Changez de plan pour y accéder.`,
    );
  }
}

/**
 * Vérifie une limite quantitative avant création.
 * Appelée côté serveur, juste avant l'insertion.
 */
export async function requireWithinLimit(
  restaurantId: string,
  limit: keyof PlanLimits,
  entitlements?: Entitlements,
): Promise<void> {
  const ent = entitlements ?? (await getEntitlements(restaurantId));
  const max = ent.limits[limit];
  if (max === undefined || max < 0) return; // pas de limite définie

  const current = await countForLimit(restaurantId, limit);
  if (current >= max) {
    throw new PlanLimitError(
      `Votre plan ${ent.planName} est limité à ${max} ${LIMIT_LABELS[limit].toLowerCase()}. Passez à un plan supérieur pour en ajouter.`,
    );
  }
}

async function countForLimit(
  restaurantId: string,
  limit: keyof PlanLimits,
): Promise<number> {
  switch (limit) {
    case 'maxProducts':
      return prisma.product.count({ where: { restaurantId } });
    case 'maxCategories':
      return prisma.category.count({ where: { restaurantId } });
    case 'maxUsers':
      return prisma.restaurantUser.count({ where: { restaurantId } });
    case 'maxOrdersPerMonth': {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return prisma.order.count({
        where: { restaurantId, placedAt: { gte: startOfMonth } },
      });
    }
  }
}
