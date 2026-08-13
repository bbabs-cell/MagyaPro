import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { deliveryZoneSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('delivery:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'deliveryZone',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(deliveryZoneSchema, await readJson(request));

  if (input.freeAbove != null && input.freeAbove < input.minOrder) {
    throw new ValidationError(
      'Le seuil de livraison offerte doit être supérieur au minimum de commande.',
      { freeAbove: 'Seuil incohérent avec le minimum de commande.' },
    );
  }

  const zone = await prisma.deliveryZone.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      fee: input.fee,
      minOrder: input.minOrder,
      freeAbove: input.freeAbove ?? null,
      isActive: input.isActive,
    },
  });

  return ok({ zone });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const context = await requireTenant('delivery:manage');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'deliveryZone',
    context.restaurant.id,
    id,
  );

  // Les commandes passées gardent leurs frais de livraison : la relation est
  // en `SetNull`, l'historique comptable reste intact.
  await prisma.deliveryZone.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
