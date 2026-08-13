'use client';

import { buildWhatsAppLink, orderStatusWhatsAppMessage } from '@/lib/whatsapp';
import { ORDER_STATUS_LABELS } from '@/lib/orders/status';
import type { OrderStatus } from '@prisma/client';

/**
 * Notifie le client par WhatsApp du statut actuel de sa commande.
 *
 * Ouvre WhatsApp avec un message déjà rédigé ; c'est l'employé qui envoie,
 * d'un geste. Rien n'est expédié automatiquement au changement de statut :
 * l'action reste volontaire, ce qui évite de spammer un client pour chaque
 * micro-étape et laisse le personnel choisir le bon moment.
 */
export function WhatsAppNotifyButton({
  restaurantName,
  customerName,
  customerPhone,
  orderNumber,
  status,
  trackingUrl,
}: {
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  orderNumber: number;
  status: OrderStatus;
  trackingUrl: string;
}) {
  const href = buildWhatsAppLink(
    customerPhone,
    orderStatusWhatsAppMessage({
      restaurantName,
      customerName,
      orderNumber,
      statusLabel: ORDER_STATUS_LABELS[status],
      trackingUrl,
    }),
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center rounded-xl border border-surface-border bg-white px-3 text-sm font-medium hover:bg-surface-sunken"
    >
      Prévenir par WhatsApp
    </a>
  );
}
