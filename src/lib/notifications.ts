import type { NotificationType, OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { sendNewOrderEmail } from '@/lib/mail';

/**
 * Notifications.
 *
 * Un événement métier produit une notification persistée (visible dans le
 * dashboard) et, selon le type, un email. Les canaux SMS et WhatsApp
 * s'ajouteront en implémentant un `NotificationChannel` supplémentaire ici :
 * les appelants (`notifyNewOrder`, …) resteront inchangés.
 *
 * Aucun canal n'est déclaré « à venir » dans l'interface tant qu'il n'est pas
 * réellement branché.
 */

export type CreateNotificationInput = {
  restaurantId?: string | null;
  storeId?: string | null;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        restaurantId: input.restaurantId ?? null,
        storeId: input.storeId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  } catch (error) {
    console.error('[notifications] Échec de création :', error);
  }
}

/** Notification + email au restaurant lorsqu'une commande arrive. */
export async function notifyNewOrder(
  restaurantId: string,
  orderId: string,
  orderNumber: number,
  total: number,
  currency: string,
): Promise<void> {
  const amount = formatMoney(total, currency);

  await createNotification({
    restaurantId,
    type: 'ORDER_CREATED',
    title: `Nouvelle commande n°${orderNumber}`,
    body: `Une commande de ${amount} vient d'être passée.`,
    href: `/dashboard/commandes/${orderId}`,
    metadata: { orderId, orderNumber, total, currency },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, email: true, settings: { select: { notificationEmail: true } } },
  });

  const recipient = restaurant?.settings?.notificationEmail ?? restaurant?.email;
  if (recipient && restaurant) {
    await sendNewOrderEmail({
      to: recipient,
      restaurantName: restaurant.name,
      orderNumber,
      total: amount,
    });
  }
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'a été confirmée',
  PREPARING: 'est en préparation',
  READY: 'est prête',
  OUT_FOR_DELIVERY: 'est en cours de livraison',
  DELIVERED: 'a été livrée',
  COMPLETED: 'est terminée',
  CANCELLED: 'a été annulée',
};

export async function notifyOrderStatusChanged(
  restaurantId: string,
  orderId: string,
  orderNumber: number,
  status: OrderStatus,
): Promise<void> {
  const message = STATUS_MESSAGES[status];
  if (!message) return;

  await createNotification({
    restaurantId,
    type: 'ORDER_STATUS_CHANGED',
    title: `Commande n°${orderNumber}`,
    body: `La commande n°${orderNumber} ${message}.`,
    href: `/dashboard/commandes/${orderId}`,
    metadata: { orderId, orderNumber, status },
  });
}

export async function notifyPaymentProofSubmitted(
  restaurantId: string,
  orderId: string,
  orderNumber: number,
): Promise<void> {
  await createNotification({
    restaurantId,
    type: 'PAYMENT_PROOF_SUBMITTED',
    title: `Preuve de paiement — commande n°${orderNumber}`,
    body: `Une preuve de paiement a été déposée pour la commande n°${orderNumber}. Vérifiez-la avant de préparer la commande.`,
    href: `/dashboard/commandes/${orderId}`,
    metadata: { orderId, orderNumber },
  });
}

export async function notifyNewReservation(
  restaurantId: string,
  reservationId: string,
  customerName: string,
  partySize: number,
  reservedFor: Date,
): Promise<void> {
  await createNotification({
    restaurantId,
    type: 'RESERVATION_CREATED',
    title: `Réservation — ${customerName}`,
    body: `${customerName} demande une table pour ${partySize} personne${partySize > 1 ? 's' : ''} le ${reservedFor.toLocaleDateString('fr-FR')} à ${reservedFor.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
    href: '/dashboard/reservations',
    metadata: { reservationId },
  });
}

export async function markNotificationRead(
  restaurantId: string,
  notificationId: string,
): Promise<void> {
  // Le filtre par restaurant empêche de marquer lues les notifications d'un
  // autre tenant à partir d'un identifiant deviné.
  await prisma.notification.updateMany({
    where: { id: notificationId, restaurantId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(restaurantId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { restaurantId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function countUnreadNotifications(restaurantId: string): Promise<number> {
  return prisma.notification.count({ where: { restaurantId, readAt: null } });
}
