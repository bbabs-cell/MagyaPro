import { ok, route } from '@/lib/api';
import { UnauthorizedError } from '@/lib/errors';
import { env } from '@/lib/env';
import { processSubscriptionLifecycle, sendExpiringSubscriptionAlerts } from '@/lib/subscription-payments';

/**
 * Cycle de vie quotidien des abonnements : alerte à 5 jours de l'échéance,
 * passage en délai de grâce à l'expiration, puis repli automatique sur le
 * plan gratuit si le délai de grâce s'écoule sans renouvellement.
 *
 * Jamais exposée sans le secret partagé, sinon n'importe qui pourrait
 * déclencher l'envoi en masse d'emails ou des changements de plan. Deux
 * déclencheurs possibles selon l'hébergeur : le cron Cloudflare
 * (`wrangler.jsonc`, en-tête `x-cron-secret`, POST) ou le Cron Vercel
 * (`vercel.json`, en-tête `Authorization: Bearer <secret>` ajouté
 * automatiquement par Vercel, GET) — les deux sont acceptés pour que la
 * route fonctionne sans changement selon la plateforme de déploiement.
 */
async function runSubscriptionLifecycle(request: Request) {
  const cronSecretHeader = request.headers.get('x-cron-secret');
  const bearer = request.headers.get('authorization');
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null;

  const authorized = Boolean(
    env.cronSecret && (cronSecretHeader === env.cronSecret || bearerSecret === env.cronSecret),
  );
  if (!authorized) {
    throw new UnauthorizedError('Secret cron invalide.');
  }

  const [alerts, lifecycle] = await Promise.all([
    sendExpiringSubscriptionAlerts(),
    processSubscriptionLifecycle(),
  ]);

  return ok({ ...alerts, ...lifecycle });
}

export const POST = route((request) => runSubscriptionLifecycle(request));
export const GET = route((request) => runSubscriptionLifecycle(request));
