import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { ForbiddenError } from '@/lib/errors';
import { requireStore, setActiveStore } from '@/lib/boutique/store-tenant';
import { createAdditionalStore } from '@/lib/boutique/store-creation';

const schema = z.object({
  name: z.string().trim().min(2, 'Donnez un nom à votre boutique.').max(80),
});

/**
 * Ouverture d'une boutique supplémentaire par un propriétaire déjà connecté.
 *
 * Trois refus explicites plutôt qu'un contrôle de permission générique :
 *
 * 1. Seul un `OWNER` peut ouvrir une boutique. Un administrateur ou un
 *    vendeur, même avec de larges droits sur la boutique où il travaille,
 *    n'engage pas de dépense au nom du propriétaire.
 * 2. Un Super Admin en session de support consulte l'espace d'un commerçant :
 *    il ne doit pas y créer une boutique qui serait facturée à ce dernier.
 * 3. Une visite guidée est anonyme.
 *
 * La boutique créée n'a ni essai ni abonnement : elle reste en lecture seule
 * jusqu'à validation de son paiement majoré (voir `createAdditionalStore`).
 */
export const POST = route(async (request) => {
  const context = await requireStore('store:view');

  if (context.isSupportAccess || context.isDemoTour || context.role !== 'OWNER') {
    throw new ForbiddenError('Seul le propriétaire d’une boutique peut en ouvrir une autre.');
  }

  const input = parseOrThrow(schema, await readJson(request));

  const store = await createAdditionalStore({
    userId: context.user.id,
    userEmail: context.user.email,
    name: input.name,
  });

  // La nouvelle boutique devient la boutique active : sans cela, le
  // propriétaire atterrirait sur l'écran d'abonnement de l'ancienne et
  // paierait pour la mauvaise.
  await setActiveStore(store.id);

  return ok({ storeId: store.id, name: store.name }, 201);
});
