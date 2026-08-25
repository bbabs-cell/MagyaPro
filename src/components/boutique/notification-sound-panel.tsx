'use client';

import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui';
import { SoundUploadField } from '@/components/account/sound-upload';

/** Son personnalisé joué à l'arrivée d'une notification (commande, rupture de stock…). */
export function NotificationSoundPanel({
  notificationSoundUrl,
  canManage,
}: {
  notificationSoundUrl: string | null;
  canManage: boolean;
}) {
  const router = useRouter();

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Son de notification</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Joué dans le tableau de bord à l&apos;arrivée d&apos;une commande, d&apos;une rupture de
        stock ou d&apos;un autre événement important.
      </p>

      <div className="mt-4">
        {canManage ? (
          <SoundUploadField
            endpoint="/api/boutique/notification-sound"
            value={notificationSoundUrl}
            onChange={() => router.refresh()}
          />
        ) : notificationSoundUrl ? (
          <audio controls src={notificationSoundUrl} className="h-10 max-w-full" />
        ) : (
          <p className="text-sm text-ink-faint">Bip par défaut (aucun son personnalisé).</p>
        )}
      </div>
    </Card>
  );
}
