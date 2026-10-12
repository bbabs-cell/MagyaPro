import webpush from 'web-push';
import { Prisma, type NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { effectivePermissions, type Permission } from '@/lib/rbac';
import { effectiveStorePermissions, type StorePermission } from '@/lib/boutique/rbac';

/**
 * Notifications push — gratuites, sans fournisseur payant.
 *
 * Le navigateur de chaque appareil fournit son propre service de push (Google
 * pour Chrome et Android, Mozilla, Apple, Microsoft) ; la plateforme y dépose
 * un message chiffré de bout en bout, signé par ses clés VAPID. Aucun compte
 * tiers, aucune facturation au message : c'est ce qui rend ce canal
 * compatible avec le modèle du produit, contrairement aux SMS.
 *
 * Ce que cela change : une commande en ligne sonne sur le téléphone du
 * restaurateur **même écran éteint**, tableau de bord fermé. Jusqu'ici elle
 * ne sonnait que si l'onglet était ouvert à l'écran.
 *
 * Tout ici est « au mieux » : un envoi qui échoue ne fait jamais échouer
 * l'action métier qui l'a déclenché. Et tant que la migration
 * `20261012120000_web_push` n'est pas appliquée, la fonction se déclare
 * simplement inactive (voir `isMissingTable`).
 */

/**
 * Services de push reconnus. Le serveur envoie une requête à l'adresse que le
 * navigateur lui a donnée : sans cette liste, quiconque pourrait enregistrer
 * une adresse arbitraire et faire appeler par le serveur une machine de son
 * choix (y compris interne).
 */
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com',
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** La table n'existe pas encore : migration non appliquée. */
function isMissingTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

type VapidKeys = { publicKey: string; privateKey: string };

let cachedKeys: VapidKeys | null = null;

/**
 * Clés VAPID : variables d'environnement si elles sont définies, sinon une
 * paire générée une fois et gardée en base. `null` si la fonction n'est pas
 * encore disponible (migration absente).
 */
export async function getVapidKeys(): Promise<VapidKeys | null> {
  if (cachedKeys) return cachedKeys;

  if (env.vapidPublicKey && env.vapidPrivateKey) {
    cachedKeys = { publicKey: env.vapidPublicKey, privateKey: env.vapidPrivateKey };
    return cachedKeys;
  }

  try {
    const existing = await prisma.pushKeys.findUnique({ where: { id: 'default' } });
    if (existing) {
      cachedKeys = { publicKey: existing.publicKey, privateKey: existing.privateKey };
      return cachedKeys;
    }

    const generated = webpush.generateVAPIDKeys();
    // Deux premières requêtes simultanées pourraient chacune générer une
    // paire : `upsert` sur une clé fixe garantit qu'une seule est gardée, et
    // la relecture rend la même à tout le monde.
    await prisma.pushKeys.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...generated },
      update: {},
    });
    const stored = await prisma.pushKeys.findUniqueOrThrow({ where: { id: 'default' } });
    cachedKeys = { publicKey: stored.publicKey, privateKey: stored.privateKey };
    return cachedKeys;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  /** Page ouverte au toucher de la notification. */
  url: string;
  /** Une notification de même `tag` remplace la précédente au lieu de s'empiler. */
  tag?: string;
  /** Les commandes et appels de table ne doivent pas attendre l'économie d'énergie. */
  urgent?: boolean;
};

/**
 * Envoie un message à tous les appareils des utilisateurs donnés. Les
 * abonnements que le service déclare morts (404, 410) sont supprimés.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;

  const keys = await getVapidKeys();
  if (!keys) return 0;

  let subscriptions;
  try {
    subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
    });
  } catch (error) {
    if (isMissingTable(error)) return 0;
    throw error;
  }
  if (subscriptions.length === 0) return 0;

  const body = JSON.stringify(payload);
  const options: webpush.RequestOptions = {
    vapidDetails: {
      subject: env.vapidSubject ?? 'mailto:contact@magyapro.app',
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
    // Une commande vieille de plus d'une heure n'a plus rien d'urgent : mieux
    // vaut ne rien afficher que réveiller quelqu'un pour une affaire close.
    TTL: payload.urgent ? 3600 : 6 * 3600,
    urgency: payload.urgent ? 'high' : 'normal',
    timeout: 5000,
  };

  let delivered = 0;
  const dead: string[] = [];
  const succeeded: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
          options,
        );
        delivered += 1;
        succeeded.push(subscription.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(subscription.id);
        } else {
          console.error('[push] Échec d’envoi :', status ?? error);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => undefined);
  }
  if (succeeded.length > 0) {
    await prisma.pushSubscription
      .updateMany({ where: { id: { in: succeeded } }, data: { lastSuccessAt: new Date() } })
      .catch(() => undefined);
  }

  return delivered;
}

/**
 * Qui doit être réveillé, selon le type de notification. Un type absent de
 * ces tables ne part jamais en push : un changement de statut que l'équipe a
 * elle-même provoqué, ou un réglage modifié, n'a rien d'une urgence.
 */
const RESTAURANT_PUSH: Partial<Record<NotificationType, { permissions: Permission[]; urgent: boolean }>> = {
  ORDER_CREATED: { permissions: ['orders:view', 'orders:update_status'], urgent: true },
  PAYMENT_PROOF_SUBMITTED: { permissions: ['orders:view'], urgent: true },
  PAYMENT_RECEIVED: { permissions: ['orders:view'], urgent: false },
  TABLE_CALL: { permissions: ['tables:view'], urgent: true },
  TABLE_BILL_REQUEST: { permissions: ['tables:view'], urgent: true },
  RESERVATION_CREATED: { permissions: ['reservations:manage'], urgent: false },
  SUBSCRIPTION_TRIAL_ENDING: { permissions: ['subscription:view'], urgent: false },
  SUBSCRIPTION_EXPIRED: { permissions: ['subscription:view'], urgent: false },
  SYSTEM_ALERT: { permissions: [], urgent: false },
};

const STORE_PUSH: Partial<Record<NotificationType, { permissions: StorePermission[]; urgent: boolean }>> = {
  OUT_OF_STOCK: { permissions: ['inventory:view', 'purchases:manage'], urgent: false },
  LOW_STOCK: { permissions: ['inventory:view', 'purchases:manage'], urgent: false },
  PAYMENT_RECEIVED: { permissions: ['credits:manage', 'finances:view'], urgent: false },
  SUBSCRIPTION_TRIAL_ENDING: { permissions: ['subscription:view'], urgent: false },
  SUBSCRIPTION_EXPIRED: { permissions: ['subscription:view'], urgent: false },
  SYSTEM_ALERT: { permissions: [], urgent: false },
};

export type PushableNotification = {
  restaurantId?: string | null;
  storeId?: string | null;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  metadata?: Record<string, unknown>;
};

/** Destinataires d'une notification de commerce : les membres qui ont le droit d'agir dessus. */
export async function pushRecipients(notification: PushableNotification): Promise<{ userIds: string[]; urgent: boolean } | null> {
  if (notification.restaurantId) {
    const rule = RESTAURANT_PUSH[notification.type];
    if (!rule) return null;
    const members = await prisma.restaurantUser.findMany({
      where: {
        restaurantId: notification.restaurantId,
        ...(notification.userId ? { userId: notification.userId } : {}),
      },
      select: { userId: true, role: true, extraPermissions: true },
    });
    const userIds = members
      .filter((member) => {
        if (rule.permissions.length === 0) return true;
        const granted = effectivePermissions(member.role, member.extraPermissions);
        return rule.permissions.some((permission) => granted.has(permission));
      })
      .map((member) => member.userId);
    return { userIds, urgent: rule.urgent };
  }

  if (notification.storeId) {
    const rule = STORE_PUSH[notification.type];
    if (!rule) return null;
    const members = await prisma.storeUser.findMany({
      where: {
        storeId: notification.storeId,
        ...(notification.userId ? { userId: notification.userId } : {}),
      },
      select: { userId: true, role: true, extraPermissions: true },
    });
    const userIds = members
      .filter((member) => {
        if (rule.permissions.length === 0) return true;
        const granted = effectiveStorePermissions(member.role, member.extraPermissions);
        return rule.permissions.some((permission) => granted.has(permission));
      })
      .map((member) => member.userId);
    return { userIds, urgent: rule.urgent };
  }

  return null;
}

/** Page ouverte par défaut quand la notification n'en précise pas. */
function defaultUrl(notification: PushableNotification): string {
  return notification.storeId ? '/boutique/dashboard/notifications' : '/dashboard/notifications';
}

/**
 * Prolonge une notification déjà enregistrée par un envoi push. Appelée par
 * `createNotification` ; n'échoue jamais.
 */
export async function pushNotification(notification: PushableNotification): Promise<void> {
  try {
    const recipients = await pushRecipients(notification);
    if (!recipients || recipients.userIds.length === 0) return;

    const subject =
      (notification.metadata?.orderId as string | undefined) ??
      (notification.metadata?.reservationId as string | undefined) ??
      (notification.metadata?.tableId as string | undefined) ??
      '';

    await sendPushToUsers(recipients.userIds, {
      title: notification.title,
      body: notification.body,
      url: notification.href ?? defaultUrl(notification),
      tag: `${notification.type}:${subject}`,
      urgent: recipients.urgent,
    });
  } catch (error) {
    console.error('[push] Notification non envoyée :', error);
  }
}
