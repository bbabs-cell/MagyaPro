import { prisma } from '@/lib/db';

/**
 * Recette réelle de MagyaPro — l'argent effectivement encaissé.
 *
 * Ce chiffre n'existait nulle part. La vue d'ensemble affichait un « volume
 * traité » qui est le chiffre d'affaires des commerçants, avec une note en bas
 * de page pour prévenir que ce n'est justement pas la recette de la
 * plateforme. Les écrans d'analyse, eux, affichaient le MRR : une projection
 * — prix du plan multiplié par le nombre d'abonnements actifs — qui suppose
 * que tout le monde paie et paie à l'heure.
 *
 * Ici, rien n'est projeté. On additionne les demandes de paiement d'abonnement
 * réellement validées (`APPROVED`), c'est-à-dire celles dont un administrateur
 * a vu la preuve et confirmé la réception. Une demande en attente ne compte
 * pas, une demande rejetée non plus.
 *
 * La date retenue est celle de la validation (`reviewedAt`), pas celle du
 * dépôt : c'est le jour où l'argent a été constaté reçu. Une preuve déposée le
 * 31 et validée le 2 appartient au mois de la validation.
 *
 * Les montants sont regroupés par devise et jamais additionnés entre elles.
 * Tous les plans sont aujourd'hui en francs CFA, mais additionner des devises
 * différentes produirait un nombre faux sans que rien ne le signale.
 */

/** Montants par devise — `{ XOF: 125000 }`. Jamais de total inter-devises. */
export type MoneyByCurrency = Record<string, number>;

export type PlatformRevenue = {
  /** Mois calendaire en cours, jusqu'à aujourd'hui. */
  currentMonth: MoneyByCurrency;
  /**
   * Mois précédent **arrêté au même jour du mois** — la base de comparaison.
   *
   * Comparer onze jours de septembre à trente-et-un jours d'août donne un
   * effondrement mécanique : le 1er du mois, la variation affichée serait
   * toujours proche de −100 %, quel que soit l'état réel des affaires. Ce
   * n'est pas une information, c'est un artefact de calendrier.
   *
   * À jour égal, les deux nombres sont comparables et la variation dit
   * quelque chose. Le total complet du mois précédent reste disponible dans
   * `previousMonthFull`, pour l'afficher sans le comparer.
   */
  previousMonth: MoneyByCurrency;
  /** Mois calendaire précédent en entier, sans troncature. */
  previousMonthFull: MoneyByCurrency;
  /** Quantième retenu pour la comparaison — sert à l'expliquer à l'écran. */
  comparisonDayOfMonth: number;
  /** Depuis toujours. */
  allTime: MoneyByCurrency;
  /** Douze derniers mois, du plus ancien au plus récent. */
  byMonth: Array<{ month: string; byCurrency: MoneyByCurrency }>;
  /** Répartition de la recette du mois entre les deux produits. */
  currentMonthByProduct: { restaurant: MoneyByCurrency; store: MoneyByCurrency };
  /** Demandes déposées et pas encore tranchées, tous produits confondus. */
  pendingCount: number;
  /**
   * Abonnements encore marqués actifs alors que leur période est terminée —
   * de l'argent dû, ou un statut à corriger. Dans les deux cas, à regarder.
   */
  overdueCount: number;
};

const MONTH_LABELS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function monthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

/** Additionne un montant dans le seau de sa devise. */
function add(into: MoneyByCurrency, currency: string, amount: number): void {
  into[currency] = (into[currency] ?? 0) + amount;
}

type ApprovedPayment = { amount: number; currency: string; reviewedAt: Date | null };

const APPROVED_SELECT = { amount: true, currency: true, reviewedAt: true } as const;

export async function getPlatformRevenue(months = 12): Promise<PlatformRevenue> {
  const now = new Date();

  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  // Une seule lecture par produit, sur les seules colonnes utiles. Le
  // découpage par mois se fait ensuite en mémoire : douze mois de paiements
  // d'abonnement représentent quelques centaines de lignes, pas de quoi
  // justifier douze requêtes.
  const [restaurantPayments, storePayments, restaurantTotals, storeTotals, pendingRestaurant, pendingStore, overdueRestaurant, overdueStore] =
    await Promise.all([
      prisma.subscriptionPayment.findMany({
        where: { status: 'APPROVED', reviewedAt: { gte: windowStart } },
        select: APPROVED_SELECT,
      }),
      prisma.storeSubscriptionPayment.findMany({
        where: { status: 'APPROVED', reviewedAt: { gte: windowStart } },
        select: APPROVED_SELECT,
      }),
      // Le cumul depuis toujours est agrégé par la base : il porte sur toutes
      // les lignes, y compris celles hors de la fenêtre de douze mois.
      prisma.subscriptionPayment.groupBy({
        by: ['currency'],
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.storeSubscriptionPayment.groupBy({
        by: ['currency'],
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.subscriptionPayment.count({ where: { status: 'PENDING' } }),
      prisma.storeSubscriptionPayment.count({ where: { status: 'PENDING' } }),
      prisma.subscription.count({
        where: { status: 'ACTIVE', currentPeriodEnd: { lt: now } },
      }),
      prisma.storeSubscription.count({
        where: { status: 'ACTIVE', currentPeriodEnd: { lt: now } },
      }),
    ]);

  // Borne de comparaison : le mois dernier, arrêté à la même heure du même
  // quantième. `setMonth` gère seul les quantièmes impossibles — un 31 mars
  // devient un 2 mars pour comparer à février, ce qui reste une borne franche
  // et commune aux deux périodes.
  const previousMonthCutoff = new Date(now);
  previousMonthCutoff.setMonth(previousMonthCutoff.getMonth() - 1);

  const currentMonth: MoneyByCurrency = {};
  const previousMonth: MoneyByCurrency = {};
  const previousMonthFull: MoneyByCurrency = {};
  const currentMonthRestaurant: MoneyByCurrency = {};
  const currentMonthStore: MoneyByCurrency = {};

  // Seaux mensuels préremplis : un mois sans aucun encaissement doit
  // apparaître à zéro, pas disparaître du graphique.
  const buckets = new Map<string, MoneyByCurrency>();
  const monthKeys: string[] = [];
  const labels = new Map<string, string>();
  for (let index = 0; index < months; index += 1) {
    const date = new Date(windowStart.getFullYear(), windowStart.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
    labels.set(key, monthLabel(date));
    buckets.set(key, {});
  }

  const fold = (payments: ApprovedPayment[], perProduct: MoneyByCurrency) => {
    for (const payment of payments) {
      // `reviewedAt` est renseigné à la validation ; la clause `gte` ci-dessus
      // exclut déjà les valeurs nulles, ce test rassure le typage.
      if (!payment.reviewedAt) continue;

      const key = `${payment.reviewedAt.getFullYear()}-${String(payment.reviewedAt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (bucket) add(bucket, payment.currency, payment.amount);

      if (payment.reviewedAt >= firstOfThisMonth) {
        add(currentMonth, payment.currency, payment.amount);
        add(perProduct, payment.currency, payment.amount);
      } else if (payment.reviewedAt >= firstOfPreviousMonth) {
        add(previousMonthFull, payment.currency, payment.amount);
        if (payment.reviewedAt <= previousMonthCutoff) {
          add(previousMonth, payment.currency, payment.amount);
        }
      }
    }
  };

  fold(restaurantPayments, currentMonthRestaurant);
  fold(storePayments, currentMonthStore);

  const allTime: MoneyByCurrency = {};
  for (const row of [...restaurantTotals, ...storeTotals]) {
    add(allTime, row.currency, row._sum.amount ?? 0);
  }

  return {
    currentMonth,
    previousMonth,
    previousMonthFull,
    comparisonDayOfMonth: now.getDate(),
    allTime,
    byMonth: monthKeys.map((key) => ({
      month: labels.get(key) ?? key,
      byCurrency: buckets.get(key) ?? {},
    })),
    currentMonthByProduct: { restaurant: currentMonthRestaurant, store: currentMonthStore },
    pendingCount: pendingRestaurant + pendingStore,
    overdueCount: overdueRestaurant + overdueStore,
  };
}

export type TenantPayment = {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  planName: string;
  paidAt: Date;
};

/**
 * Règlements d'abonnement validés d'un client, du plus récent au plus ancien.
 *
 * La fiche d'un client ne disait pas ce qu'il avait payé. Pour répondre à
 * « est-ce que celui-ci règle bien ses factures », il fallait ouvrir la liste
 * des paiements en attente — qui ne montre justement que ce qui n'est pas
 * encore validé — ou renoncer.
 */
export async function listRestaurantPayments(
  restaurantId: string,
  take = 6,
): Promise<TenantPayment[]> {
  const rows = await prisma.subscriptionPayment.findMany({
    where: { restaurantId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' },
    take,
    select: {
      id: true,
      amount: true,
      currency: true,
      provider: true,
      reviewedAt: true,
      createdAt: true,
      plan: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    provider: row.provider,
    planName: row.plan.name,
    // `reviewedAt` est renseigné à la validation ; la date de dépôt sert de
    // repli pour d'éventuelles lignes anciennes qui n'en portent pas.
    paidAt: row.reviewedAt ?? row.createdAt,
  }));
}

export async function listStorePayments(storeId: string, take = 6): Promise<TenantPayment[]> {
  const rows = await prisma.storeSubscriptionPayment.findMany({
    where: { storeId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' },
    take,
    select: {
      id: true,
      amount: true,
      currency: true,
      provider: true,
      reviewedAt: true,
      createdAt: true,
      plan: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    provider: row.provider,
    planName: row.plan.name,
    paidAt: row.reviewedAt ?? row.createdAt,
  }));
}

/**
 * Devise principale d'un ensemble de montants : celle qui pèse le plus lourd.
 *
 * Les écrans ont besoin d'un chiffre en tête d'affiche. Tant qu'une seule
 * devise circule — le cas aujourd'hui — c'est simplement celle-là ; le jour où
 * une seconde apparaît, la fonction désigne la dominante et l'appelant reste
 * libre d'afficher le reste à côté plutôt que de tout additionner.
 */
export function primaryCurrency(amounts: MoneyByCurrency, fallback = 'XOF'): string {
  const entries = Object.entries(amounts);
  if (entries.length === 0) return fallback;
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/** Montant dans une devise donnée, zéro si elle n'apparaît pas. */
export function amountIn(amounts: MoneyByCurrency, currency: string): number {
  return amounts[currency] ?? 0;
}
