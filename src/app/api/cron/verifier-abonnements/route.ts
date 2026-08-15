import { ok, route } from '@/lib/api';
import { UnauthorizedError } from '@/lib/errors';
import { env } from '@/lib/env';
import { processSubscriptionLifecycle, sendExpiringSubscriptionAlerts } from '@/lib/subscription-payments';

/**
 * Cycle de vie quotidien des abonnements : alerte à 5 jours de l'échéance,
 * passage en délai de grâce à l'expiration, puis repli automatique sur le
 * plan gratuit si le délai de grâce s'écoule sans renouvellement. Appelée
 * par le déclencheur cron Cloudflare (`wrangler.jsonc`), qui transmet le
 * secret partagé — jamais exposée sans lui, sinon n'importe qui pourrait
 * déclencher l'envoi en masse d'emails ou des changements de plan.
 */
export const POST = route(async (request) => {
  const secret = request.headers.get('x-cron-secret');
  if (!env.cronSecret || secret !== env.cronSecret) {
    throw new UnauthorizedError('Secret cron invalide.');
  }

  const [alerts, lifecycle] = await Promise.all([
    sendExpiringSubscriptionAlerts(),
    processSubscriptionLifecycle(),
  ]);

  return ok({ ...alerts, ...lifecycle });
});
