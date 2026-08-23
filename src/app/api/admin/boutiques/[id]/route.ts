import { z } from 'zod';

import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, currentClientIp } from '@/lib/auth/session';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Change le statut d'une boutique depuis l'administration — miroir de
 * `/api/admin/restaurants/[id]` (PATCH statut, DELETE suppression), jamais
 * partagé : la boutique n'a pas de `publishedAt` sur le même modèle que le
 * restaurant, donc pas de champ équivalent à réinitialiser ici.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!store) throw new NotFoundError('Boutique introuvable.');

  const input = parseOrThrow(statusSchema, await readJson(request));

  if (input.status === 'SUSPENDED' && !input.reason) {
    throw new ValidationError(
      'Indiquez le motif de la suspension : il est consigné au journal.',
      { reason: 'Motif requis.' },
    );
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      status: input.status,
      publishedAt: input.status === 'ACTIVE' ? new Date() : null,
    },
  });

  await recordAudit({
    action:
      input.status === 'SUSPENDED'
        ? AUDIT_ACTIONS.STORE_SUSPENDED
        : AUDIT_ACTIONS.STORE_REACTIVATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    storeId: store.id,
    targetType: 'store',
    targetId: store.id,
    ip: await currentClientIp(),
    metadata: { from: store.status, to: input.status, reason: input.reason },
  });

  return ok({ store: { id: updated.id, status: updated.status } });
});

const deleteSchema = z.object({
  confirmation: z.string().trim().min(1),
});

/** Suppression définitive d'une boutique — mêmes garde-fous que Restaurant. */
export const DELETE = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { sales: true } },
    },
  });
  if (!store) throw new NotFoundError('Boutique introuvable.');

  const { confirmation } = parseOrThrow(deleteSchema, await readJson(request));

  if (confirmation !== store.name) {
    throw new ValidationError(
      'Le nom saisi ne correspond pas à celui de la boutique.',
      { confirmation: 'Saisissez le nom exact de la boutique.' },
    );
  }

  if (store.status !== 'SUSPENDED') {
    throw new ConflictError(
      'Suspendez la boutique avant de la supprimer. Cela laisse une trace et évite les suppressions accidentelles.',
    );
  }

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_DELETED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'store',
    targetId: store.id,
    ip: await currentClientIp(),
    metadata: {
      name: store.name,
      salesDeleted: store._count.sales,
    },
  });

  await prisma.store.delete({ where: { id: store.id } });

  return ok({ deleted: true });
});
