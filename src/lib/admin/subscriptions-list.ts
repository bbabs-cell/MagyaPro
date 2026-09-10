import type { Prisma, SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Listes d'abonnements du Super Admin — filtrées, cherchables, paginées.
 *
 * Les deux écrans chargeaient la totalité de la table : ni recherche, ni
 * pagination, alors que les listes voisines — Restaurants, Boutiques,
 * Utilisateurs, Journal — les avaient déjà. Invisible avec quelques dizaines
 * de clients, coûteux à quelques centaines, et surtout : retrouver un client
 * précis demandait de faire défiler.
 *
 * S'y ajoute le filtre qui manquait le plus, `echeance`. La question posée à
 * cet écran n'est pas seulement « qui est abonné » mais « qui dois-je relancer
 * cette semaine ». Elle se réglait à l'œil, en triant par date de fin.
 *
 * Deux fonctions plutôt qu'une : Restaurant et Boutique n'ont ni les mêmes
 * tables ni les mêmes relations. Elles partagent en revanche exactement la
 * même forme d'entrée et de sortie, pour que les deux écrans restent lisibles
 * côte à côte et qu'une évolution de l'un se transpose sans réflexion à
 * l'autre.
 */

export const SUBSCRIPTIONS_PAGE_SIZE = 25;

/** Fenêtre de relance : « bientôt », c'est dans les sept jours. */
export const RENEWAL_SOON_DAYS = 7;

export type DeadlineFilter = 'soon' | 'overdue';

export function isDeadlineFilter(value: string): value is DeadlineFilter {
  return value === 'soon' || value === 'overdue';
}

export type SubscriptionListOptions = {
  status?: SubscriptionStatus;
  /** Nom ou adresse du tenant. */
  search?: string;
  deadline?: DeadlineFilter;
  page?: number;
};

/**
 * Contrainte de date correspondant au filtre d'échéance.
 *
 * `overdue` — la période est terminée : l'argent est dû, ou le statut n'a pas
 * été mis à jour. `soon` — elle se termine dans les sept jours, donc pas
 * encore dépassée : les deux ensembles ne se recouvrent jamais, sans quoi le
 * même client apparaîtrait dans les deux relances.
 */
function deadlineWhere(deadline: DeadlineFilter | undefined, now: Date) {
  if (!deadline) return undefined;
  if (deadline === 'overdue') return { lt: now };

  const limit = new Date(now);
  limit.setDate(limit.getDate() + RENEWAL_SOON_DAYS);
  return { gte: now, lte: limit };
}

export type SubscriptionRow = {
  id: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  tenant: { id: string; name: string; slug: string };
  plan: { name: string; price: number; currency: string; interval: 'MONTH' | 'YEAR'; product: string };
};

export type SubscriptionListResult = {
  rows: SubscriptionRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Nombre d'échéances dépassées et proches, sur toute la plateforme et non
   *  sur la sélection courante : ce sont des compteurs d'alerte, ils ne
   *  doivent pas changer quand on filtre. */
  counts: { overdue: number; soon: number };
};

const PLAN_SELECT = {
  select: { name: true, price: true, currency: true, interval: true, product: true },
} as const;

export async function listRestaurantSubscriptions(
  options: SubscriptionListOptions = {},
): Promise<SubscriptionListResult> {
  const now = new Date();
  const page = Math.max(1, options.page ?? 1);
  const periodEnd = deadlineWhere(options.deadline, now);

  const where: Prisma.SubscriptionWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    ...(options.search
      ? {
          restaurant: {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' as const } },
              { slug: { contains: options.search, mode: 'insensitive' as const } },
              { email: { contains: options.search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [rows, total, overdue, soon] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { currentPeriodEnd: 'asc' },
      skip: (page - 1) * SUBSCRIPTIONS_PAGE_SIZE,
      take: SUBSCRIPTIONS_PAGE_SIZE,
      include: {
        plan: PLAN_SELECT,
        restaurant: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.subscription.count({ where }),
    prisma.subscription.count({
      where: { status: 'ACTIVE', currentPeriodEnd: deadlineWhere('overdue', now) },
    }),
    prisma.subscription.count({
      where: { status: 'ACTIVE', currentPeriodEnd: deadlineWhere('soon', now) },
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd,
      tenant: row.restaurant,
      plan: row.plan,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SUBSCRIPTIONS_PAGE_SIZE)),
    counts: { overdue, soon },
  };
}

export async function listStoreSubscriptions(
  options: SubscriptionListOptions = {},
): Promise<SubscriptionListResult> {
  const now = new Date();
  const page = Math.max(1, options.page ?? 1);
  const periodEnd = deadlineWhere(options.deadline, now);

  const where: Prisma.StoreSubscriptionWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    ...(options.search
      ? {
          store: {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' as const } },
              { slug: { contains: options.search, mode: 'insensitive' as const } },
              { email: { contains: options.search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [rows, total, overdue, soon] = await Promise.all([
    prisma.storeSubscription.findMany({
      where,
      orderBy: { currentPeriodEnd: 'asc' },
      skip: (page - 1) * SUBSCRIPTIONS_PAGE_SIZE,
      take: SUBSCRIPTIONS_PAGE_SIZE,
      include: {
        plan: PLAN_SELECT,
        store: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.storeSubscription.count({ where }),
    prisma.storeSubscription.count({
      where: { status: 'ACTIVE', currentPeriodEnd: deadlineWhere('overdue', now) },
    }),
    prisma.storeSubscription.count({
      where: { status: 'ACTIVE', currentPeriodEnd: deadlineWhere('soon', now) },
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd,
      tenant: row.store,
      plan: row.plan,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SUBSCRIPTIONS_PAGE_SIZE)),
    counts: { overdue, soon },
  };
}

/**
 * Nombre de jours entiers jusqu'à l'échéance, négatif si elle est passée.
 *
 * Les deux dates sont ramenées à minuit : « dans 1 jour » doit vouloir dire
 * demain, pas « dans 18 heures ». Sans cela, une échéance à 23 h ce soir et
 * une à 1 h demain matin s'affichent toutes deux « dans 0 jour ».
 */
export function daysUntil(deadline: Date, now: Date = new Date()): number {
  const startOfDeadline = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startOfDeadline.getTime() - startOfToday.getTime()) / 86_400_000);
}

/** Formulation en clair d'une échéance, du point de vue de la plateforme. */
export function deadlineLabel(days: number): string {
  if (days < 0) return `dépassée de ${-days} jour${-days > 1 ? 's' : ''}`;
  if (days === 0) return "se termine aujourd'hui";
  if (days === 1) return 'se termine demain';
  return `dans ${days} jours`;
}
