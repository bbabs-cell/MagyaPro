import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ isActive: z.boolean() });

/** Active/désactive un webhook sans le supprimer — utile pour suspendre un envoi défaillant. */
export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('api:manage');
  const { id } = await params;
  const { isActive } = parseOrThrow(patchSchema, await readJson(request));

  const webhook = await prisma.storeWebhook.findFirst({ where: { id, storeId: context.store.id } });
  if (!webhook) throw new NotFoundError('Webhook introuvable.');

  const updated = await prisma.storeWebhook.update({ where: { id: webhook.id }, data: { isActive } });

  return ok({ webhook: { id: updated.id, isActive: updated.isActive } });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('api:manage');
  const { id } = await params;

  const webhook = await prisma.storeWebhook.findFirst({ where: { id, storeId: context.store.id } });
  if (!webhook) throw new NotFoundError('Webhook introuvable.');

  await prisma.storeWebhook.delete({ where: { id: webhook.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_WEBHOOK_DELETED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_webhook',
    targetId: webhook.id,
    metadata: { url: webhook.url },
  });

  return ok({ success: true });
});
