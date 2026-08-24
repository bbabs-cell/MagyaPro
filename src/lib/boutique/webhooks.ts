import { createHmac, randomBytes } from 'node:crypto';
import type { StoreWebhookEvent } from '@prisma/client';

import { prisma } from '@/lib/db';
import { assertPublicWebhookUrl } from '@/lib/boutique/webhook-url';

/**
 * Envoi des webhooks sortants — jamais bloquant pour l'opération qui
 * déclenche l'événement (vente, commande, stock bas), même principe de
 * tolérance à l'échec que `createNotification`/`sendSms`.
 */

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

/**
 * Signature HMAC-SHA256 du corps, à vérifier côté destinataire sur l'en-tête
 * `X-Magyapro-Signature`. Exportée pour être testable directement (voir
 * `tests/boutique-api-integrations.test.ts`) sans avoir à mocker `fetch`.
 */
export function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export async function triggerWebhooks(
  storeId: string,
  event: StoreWebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const webhooks = await prisma.storeWebhook.findMany({
    where: { storeId, isActive: true, events: { has: event } },
  });
  if (webhooks.length === 0) return;

  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data });

  await Promise.all(
    webhooks.map(async (webhook) => {
      try {
        // Revérifie l'URL à chaque envoi, pas seulement à l'enregistrement
        // du webhook (voir `assertPublicWebhookUrl`) : un hôte dont la
        // résolution DNS aurait changé depuis (rebinding) vers une adresse
        // interne est ainsi rejeté ici aussi, pas seulement au moment où le
        // commerçant a saisi l'URL.
        await assertPublicWebhookUrl(webhook.url);
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Magyapro-Signature': sign(webhook.secret, body),
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
      } catch (error) {
        console.error(`[webhooks] Échec d'envoi vers ${webhook.url} :`, error);
      }
    }),
  );
}
