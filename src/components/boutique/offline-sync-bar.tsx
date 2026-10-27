'use client';

import { OfflineQueueBar } from '@/components/offline/offline-queue-bar';
import { salesQueueScope } from '@/lib/boutique/offline-queue';

/** Les ventes de la caisse en attente de réseau — voir `OfflineQueueBar`. */
export function OfflineSyncBar({ storeId }: { storeId: string }) {
  return <OfflineQueueBar scope={salesQueueScope(storeId)} endpoint="/api/boutique/sales" noun="vente" />;
}
