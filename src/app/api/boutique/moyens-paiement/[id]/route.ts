import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { NotFoundError, ValidationError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ isEnabled: z.boolean() });

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireStore('settings:manage');
  const { id } = await params;
  const { isEnabled } = parseOrThrow(patchSchema, await readJson(request));

  const method = await prisma.storePaymentMethod.findFirst({
    where: { id, storeId: context.store.id },
  });
  if (!method) throw new NotFoundError('Moyen de paiement introuvable.');

  if (!isEnabled) {
    const enabledCount = await prisma.storePaymentMethod.count({
      where: { storeId: context.store.id, isEnabled: true },
    });
    if (enabledCount <= 1) {
      throw new ValidationError('Au moins un moyen de paiement doit rester actif.');
    }
  }

  const updated = await prisma.storePaymentMethod.update({
    where: { id: method.id },
    data: { isEnabled },
  });

  return ok({ method: updated });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireStore('settings:manage');
  const { id } = await params;

  const method = await prisma.storePaymentMethod.findFirst({
    where: { id, storeId: context.store.id },
  });
  if (!method) throw new NotFoundError('Moyen de paiement introuvable.');

  if (method.isEnabled) {
    const enabledCount = await prisma.storePaymentMethod.count({
      where: { storeId: context.store.id, isEnabled: true },
    });
    if (enabledCount <= 1) {
      throw new ValidationError('Au moins un moyen de paiement doit rester actif.');
    }
  }

  await prisma.storePaymentMethod.delete({ where: { id: method.id } });

  return ok({ success: true });
});
