import type { OrderStatus } from '@prisma/client';

import { sendSms } from '@/lib/sms';
import { formatMoney } from '@/lib/money';

/**
 * SMS envoyés au *client final* d'un restaurant — distinct de
 * `notifications.ts`, qui alimente le centre de notifications du
 * restaurateur (dashboard + email). Ici, aucune trace n'est conservée en
 * base : ce sont des envois sortants, pas des notifications à afficher
 * quelque part.
 */

export async function smsOrderConfirmation(params: {
  customerPhone: string;
  restaurantName: string;
  orderNumber: number;
  total: number;
  currency: string;
}): Promise<void> {
  const amount = formatMoney(params.total, params.currency);
  await sendSms(
    params.customerPhone,
    `${params.restaurantName} : votre commande n°${params.orderNumber} (${amount}) est bien reçue. Merci !`,
  );
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'est confirmée',
  PREPARING: 'est en préparation',
  READY: 'est prête',
  OUT_FOR_DELIVERY: 'est en cours de livraison',
  DELIVERED: 'a été livrée',
  COMPLETED: 'est terminée',
  CANCELLED: 'a été annulée',
};

export async function smsOrderStatusChanged(params: {
  customerPhone: string;
  restaurantName: string;
  orderNumber: number;
  status: OrderStatus;
}): Promise<void> {
  const message = STATUS_MESSAGES[params.status];
  if (!message) return;

  await sendSms(
    params.customerPhone,
    `${params.restaurantName} : votre commande n°${params.orderNumber} ${message}.`,
  );
}
