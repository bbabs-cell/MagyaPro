import { headers } from 'next/headers';

import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/session';
import { sendPushToUsers } from '@/lib/push';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

/**
 * Message d'essai sur les appareils de l'utilisateur connecté — pour vérifier,
 * au moment où on active les alertes, qu'elles arrivent vraiment. Ne touche
 * que les appareils de la personne elle-même.
 */
export const POST = route(async () => {
  const user = await requireUser();
  await hit(`push:test:${user.id}`, RATE_LIMITS.tableCall);

  const referer = (await headers()).get('referer') ?? '';
  const url = referer.includes('/boutique/dashboard') ? '/boutique/dashboard' : '/dashboard';

  const delivered = await sendPushToUsers([user.id], {
    title: 'MagyaPro — essai réussi',
    body: 'Les alertes arrivent bien sur cet appareil, même tableau de bord fermé.',
    url,
    tag: 'push-test',
    urgent: true,
  });

  return ok({ delivered });
});
