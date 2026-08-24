import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { storeWebhookSchema } from '@/lib/validation';
import { assertPublicWebhookUrl } from '@/lib/boutique/webhook-url';
import { generateWebhookSecret } from '@/lib/boutique/webhooks';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { store } = await requireStore('api:manage');

  const webhooks = await prisma.storeWebhook.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, events: true, isActive: true, createdAt: true },
  });

  return ok({ webhooks });
});

export const POST = route(async (request) => {
  const context = await requireStore('api:manage');
  await hit(`boutique-webhook-create:${context.store.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(storeWebhookSchema, await readJson(request));
  await assertPublicWebhookUrl(input.url);

  const secret = generateWebhookSecret();
  const created = await prisma.storeWebhook.create({
    data: { storeId: context.store.id, url: input.url, events: input.events, secret },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_WEBHOOK_CREATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_webhook',
    targetId: created.id,
    metadata: { url: input.url, events: input.events },
  });

  // Le secret en clair n'est renvoyé qu'ici, une seule fois.
  return ok(
    { id: created.id, url: created.url, events: created.events, secret },
    201,
  );
});
