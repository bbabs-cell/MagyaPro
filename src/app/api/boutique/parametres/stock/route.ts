import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { notifySettingsChanged } from '@/lib/notifications';

const schema = z.object({ allowNegativeStock: z.boolean() });

/**
 * Réglages de stock d'une boutique. Aujourd'hui uniquement la vente à
 * découvert : autoriser une sortie supérieure au disponible, utile quand le
 * stock informatique est en retard sur le stock réel. Le blocage reste actif
 * par défaut (voir `Store.allowNegativeStock`).
 */
export const PATCH = route(async (request) => {
  const context = await requireStore('settings:manage');
  const input = parseOrThrow(schema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: { allowNegativeStock: input.allowNegativeStock },
    select: { id: true, allowNegativeStock: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    metadata: { allowNegativeStock: input.allowNegativeStock },
  });

  await notifySettingsChanged({
    storeId: context.store.id,
    section: 'Stock',
    actorName: context.user.name,
    href: '/boutique/dashboard/parametres',
  });

  return ok({ store });
});
