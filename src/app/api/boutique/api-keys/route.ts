import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { generateApiKey } from '@/lib/boutique/api-auth';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('api:manage');

  const keys = await prisma.storeApiKey.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return ok({ keys });
});

const createKeySchema = z.object({ name: z.string().trim().min(1).max(60) });

export const POST = route(async (request) => {
  const context = await requireStore('api:manage');
  hit(`boutique-api-key-create:${context.store.id}`, RATE_LIMITS.write);

  const { name } = parseOrThrow(createKeySchema, await readJson(request));
  const { key, keyHash, keyPrefix } = generateApiKey();

  const created = await prisma.storeApiKey.create({
    data: { storeId: context.store.id, name, keyHash, keyPrefix },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_API_KEY_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_api_key',
    targetId: created.id,
    metadata: { name },
  });

  // La clé en clair n'est renvoyée qu'ici, une seule fois — jamais relisible ensuite.
  return ok({ key, id: created.id, name: created.name, keyPrefix: created.keyPrefix }, 201);
});
