import { ok, route } from '@/lib/api';
import { UnauthorizedError } from '@/lib/errors';
import { env } from '@/lib/env';
import { sendExpiringSubscriptionAlerts } from '@/lib/subscription-payments';

/**
 * Vérifie les abonnements qui expirent dans 5 jours et alerte les
 * restaurateurs concernés. Appelée quotidiennement par le déclencheur cron
 * Cloudflare (`wrangler.jsonc`), qui transmet le secret partagé — jamais
 * exposée sans lui, sinon n'importe qui pourrait déclencher l'envoi en masse
 * d'emails.
 */
export const POST = route(async (request) => {
  const secret = request.headers.get('x-cron-secret');
  if (!env.cronSecret || secret !== env.cronSecret) {
    throw new UnauthorizedError('Secret cron invalide.');
  }

  const result = await sendExpiringSubscriptionAlerts();
  return ok(result);
});
