'use client';

import { enqueue, type QueuedRequest } from '@/lib/client/offline-queue';

/**
 * File d'attente des ventes enregistrées hors ligne par la caisse — voir
 * `lib/client/offline-queue.ts`, partagé avec la prise de commande au
 * comptoir des restaurants. La clé de stockage n'a pas changé
 * (`magyapro:offline-sales:<boutique>`) : les ventes laissées en attente
 * avant la mise à jour partent comme les autres.
 */
export type QueuedSale = QueuedRequest;

export function salesQueueScope(storeId: string): string {
  return `sales:${storeId}`;
}

export function enqueueSale(storeId: string, payload: unknown): QueuedSale {
  return enqueue(salesQueueScope(storeId), payload);
}
