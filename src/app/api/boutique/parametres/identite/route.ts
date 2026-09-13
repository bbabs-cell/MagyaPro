import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeIdentitySchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/**
 * Identité de la boutique — ce qui figure sur ses factures.
 *
 * Ces informations n'étaient saisies qu'à l'inscription et n'avaient plus
 * aucun écran pour les corriger. Une adresse fausse restait fausse sur tous
 * les documents remis aux clients.
 */
export const PATCH = route(async (request) => {
  // `context.store.id` vient de la session, jamais du corps de la requête.
  const context = await requireStore('settings:manage');
  const input = parseOrThrow(storeIdentitySchema, await readJson(request));

  const store = await prisma.store.update({
    where: { id: context.store.id },
    data: {
      name: input.name,
      phone: input.phone ?? null,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      legalId: input.legalId ?? null,
    },
    select: { id: true, name: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store',
    targetId: context.store.id,
    metadata: { section: 'identite' },
  });

  return ok({ store });
});
