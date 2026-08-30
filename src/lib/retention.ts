import { prisma } from '@/lib/db';

/**
 * Purge des données d'exploitation périmées.
 *
 * La base ne nettoyait que les sessions expirées et le compteur anti-abus.
 * Tout le reste s'accumulait indéfiniment : sur trois ans, le journal d'audit
 * et les notifications finissent par peser plus lourd que les ventes qu'ils
 * accompagnent, et l'hébergement se paie au gigaoctet.
 *
 * CE QUI N'EST JAMAIS SUPPRIMÉ
 *
 * Ventes, lignes de vente, paiements, factures, mouvements de stock, lots,
 * achats, dettes fournisseurs, clients : ce sont des écritures comptables. Un
 * commerçant doit pouvoir les produire des années plus tard, en cas de
 * contrôle comme de litige, et l'espace disque n'est jamais une raison
 * suffisante pour effacer la trace d'un mouvement d'argent ou de marchandise.
 * Les mouvements de stock en particulier sont le registre qui explique
 * pourquoi le stock actuel vaut ce qu'il vaut : les purger rendrait tout
 * l'inventaire inexplicable.
 *
 * CE QUI EST SUPPRIMÉ, ET POURQUOI
 *
 * Uniquement de l'exploitation courante, dont personne ne redemande le détail
 * passé quelques mois : notifications déjà lues, journal d'audit ancien,
 * jetons de vérification périmés. Aucune de ces lignes ne documente une
 * transaction.
 */

/**
 * Durées de conservation, en jours.
 *
 * Deux ans pour le journal d'audit : c'est ce qu'il faut pour instruire un
 * litige d'équipe ou un accès contesté, bien au-delà du délai où l'on regarde
 * encore « qui a modifié ce prix ». Trois mois pour une notification lue,
 * qui a rempli son office à la seconde où elle a été ouverte.
 */
export const RETENTION_DAYS = {
  auditLog: 730,
  readNotification: 90,
  /** Une notification jamais ouverte reste plus longtemps : elle a peut-être été manquée. */
  unreadNotification: 365,
  platformNotification: 180,
} as const;

/**
 * Suppression par lots plutôt qu'en un seul ordre.
 *
 * Un `DELETE` portant sur des centaines de milliers de lignes verrouille la
 * table, gonfle le journal des transactions et dépasse le temps d'exécution
 * alloué à une fonction serverless. Le plafond par exécution est volontaire :
 * la purge reprend le lendemain là où elle s'est arrêtée, et une base très en
 * retard se résorbe en quelques jours au lieu de faire échouer la tâche
 * chaque nuit.
 */
const BATCH_SIZE = 2_000;
const MAX_BATCHES_PER_RUN = 15;

async function purgeInBatches(
  deleteBatch: (limit: number) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const deleted = await deleteBatch(BATCH_SIZE);
    total += deleted;
    if (deleted < BATCH_SIZE) break;
  }
  return total;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export type RetentionResult = {
  auditLogs: number;
  notifications: number;
  platformNotifications: number;
  verificationTokens: number;
};

export async function purgeExpiredData(): Promise<RetentionResult> {
  const auditLogs = await purgeInBatches(async (limit) => {
    const rows = await prisma.auditLog.findMany({
      where: { createdAt: { lt: daysAgo(RETENTION_DAYS.auditLog) } },
      select: { id: true },
      take: limit,
    });
    if (rows.length === 0) return 0;
    const { count } = await prisma.auditLog.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return count;
  });

  const notifications = await purgeInBatches(async (limit) => {
    const rows = await prisma.notification.findMany({
      where: {
        OR: [
          { readAt: { not: null }, createdAt: { lt: daysAgo(RETENTION_DAYS.readNotification) } },
          { readAt: null, createdAt: { lt: daysAgo(RETENTION_DAYS.unreadNotification) } },
        ],
      },
      select: { id: true },
      take: limit,
    });
    if (rows.length === 0) return 0;
    const { count } = await prisma.notification.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return count;
  });

  const platformNotifications = await purgeInBatches(async (limit) => {
    const rows = await prisma.platformNotification.findMany({
      where: { createdAt: { lt: daysAgo(RETENTION_DAYS.platformNotification) } },
      select: { id: true },
      take: limit,
    });
    if (rows.length === 0) return 0;
    const { count } = await prisma.platformNotification.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return count;
  });

  // Jetons de vérification et de réinitialisation périmés. Ils ne sont
  // supprimés aujourd'hui qu'au moment d'être utilisés : ceux que personne
  // n'ouvre restent en base pour toujours. Un jeton expiré n'ouvre plus rien,
  // le conserver n'a aucun usage et prolonge inutilement l'exposition de son
  // empreinte.
  const { count: verificationTokens } = await prisma.verificationToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return { auditLogs, notifications, platformNotifications, verificationTokens };
}
