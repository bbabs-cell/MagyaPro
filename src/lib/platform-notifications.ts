import { prisma } from '@/lib/db';

/**
 * Notifications de l'espace Super Admin — voir `PlatformNotification`.
 *
 * Volontairement séparé de `src/lib/notifications.ts`, qui ne sait écrire que
 * pour un restaurant ou une boutique : mélanger les deux ferait porter à une
 * même fonction deux règles d'isolation incompatibles.
 */

export const PLATFORM_NOTIFICATION_TYPES = {
  /** Un commerçant a déposé une preuve de paiement à valider. */
  SUBSCRIPTION_PAYMENT: 'SUBSCRIPTION_PAYMENT',
} as const;

export type PlatformNotificationType =
  (typeof PLATFORM_NOTIFICATION_TYPES)[keyof typeof PLATFORM_NOTIFICATION_TYPES];

/**
 * Enregistre une notification pour les Super Admins.
 *
 * Ne lève jamais : une notification manquante ne doit pas faire échouer
 * l'action qui l'a déclenchée. Un commerçant qui dépose sa preuve de paiement
 * ne doit pas voir une erreur parce que la table de notifications est
 * indisponible — il a payé, c'est ce qui compte.
 */
export async function createPlatformNotification(params: {
  type: PlatformNotificationType;
  title: string;
  body: string;
  href?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.platformNotification.create({
      data: {
        type: params.type,
        title: params.title,
        body: params.body,
        href: params.href ?? null,
        metadata: (params.metadata ?? {}) as never,
      },
    });
  } catch (error) {
    console.error('[platform-notifications] création impossible', error);
  }
}

export async function countUnreadPlatformNotifications(): Promise<number> {
  return prisma.platformNotification.count({ where: { readAt: null } });
}

export async function listPlatformNotifications(take = 100) {
  return prisma.platformNotification.findMany({
    orderBy: { createdAt: 'desc' },
    take,
  });
}
