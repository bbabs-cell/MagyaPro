import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { notifySettingsChanged } from '@/lib/notifications';
import { seedStoreUnits } from '@/lib/boutique/units-engine';

const schema = z.object({
  businessType: z.enum([
    'CLOTHING',
    'SHOES',
    'ELECTRONICS',
    'COSMETICS',
    'GROCERY',
    'MERCERIE',
    'HARDWARE',
    'CONSTRUCTION',
    'HOUSEHOLD',
    'PHARMACY',
    'GENERAL',
    'OTHER',
  ]),
});

/**
 * Change le secteur d'activité d'une boutique.
 *
 * Le secteur ne pilote aucune logique de stock — il sélectionne un profil :
 * unités semées, attributs et axes de déclinaison suggérés. En changer
 * complète donc le jeu d'unités avec celles du nouveau métier, sans jamais
 * retirer ni désactiver les précédentes : un commerçant qui élargit son
 * activité garde tout ce qu'il utilisait déjà.
 */
export const PATCH = route(async (request) => {
  const context = await requireStore('settings:manage');
  const input = parseOrThrow(schema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: { businessType: input.businessType },
    select: { id: true, businessType: true },
  });

  await seedStoreUnits(context.store.id, input.businessType);

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    metadata: { businessType: input.businessType },
  });

  await notifySettingsChanged({
    storeId: context.store.id,
    section: 'Secteur',
    actorName: context.user.name,
    href: '/boutique/dashboard/parametres',
  });

  return ok({ store });
});
