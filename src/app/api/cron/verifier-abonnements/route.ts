import { ok, route } from '@/lib/api';
import { UnauthorizedError } from '@/lib/errors';
import { env } from '@/lib/env';
import { processSubscriptionLifecycle, sendExpiringSubscriptionAlerts } from '@/lib/subscription-payments';
import {
  processStoreSubscriptionLifecycle,
  sendExpiringStoreSubscriptionAlerts,
} from '@/lib/boutique/subscription-payments';
import { purgeExpiredData } from '@/lib/retention';

/**
 * Tâche de nuit : cycle de vie des abonnements, puis purge des données
 * d'exploitation périmées.
 *
 * Cycle de vie : alerte à 5 jours de l'échéance, passage en délai de grâce à
 * l'expiration, puis suspension si le délai s'écoule sans renouvellement.
 *
 * Purge : notifications lues, journal d'audit ancien, jetons périmés. Jamais
 * une écriture comptable — voir `src/lib/retention.ts`.
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

  const [alerts, lifecycle, storeAlerts, storeLifecycle] = await Promise.all([
    sendExpiringSubscriptionAlerts(),
    processSubscriptionLifecycle(),
    sendExpiringStoreSubscriptionAlerts(),
    processStoreSubscriptionLifecycle(),
  ]);

  // Purge quotidienne, lancée après le cycle de vie et non en parallèle : les
  // deux écrivent en base, et rien ne presse. Greffée sur cette tâche plutôt
  // que sur la sienne, car l'hébergeur limite le nombre de tâches planifiées
  // et une seule visite nocturne suffit.
  const purge = await purgeExpiredData();

  return ok({
    restaurants: { ...alerts, ...lifecycle },
    stores: { ...storeAlerts, ...storeLifecycle },
    purge,
  });
}

export const POST = route((request) => runSubscriptionLifecycle(request));
export const GET = route((request) => runSubscriptionLifecycle(request));
