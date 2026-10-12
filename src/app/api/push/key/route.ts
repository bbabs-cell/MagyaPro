import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { getVapidKeys } from '@/lib/push';

/**
 * Clé publique VAPID, nécessaire au navigateur pour s'abonner. `enabled` est
 * faux tant que la fonction n'est pas disponible sur l'instance (migration
 * non appliquée) : l'interface le dit au lieu de proposer un bouton inerte.
 */
export const GET = route(async () => {
  await requireUser();
  const keys = await getVapidKeys();
  return ok({ enabled: keys !== null, publicKey: keys?.publicKey ?? null });
});
