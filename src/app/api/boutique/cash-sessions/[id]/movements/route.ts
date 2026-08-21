import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { cashMovementSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

export const POST = route(async (request, { params }: Params) => {
  const context = await requireStore('cash:manage');
  const { id } = await params;

  const session = await prisma.cashSession.findFirst({
    where: { id, storeId: context.store.id },
  });
  if (!session) throw new NotFoundError('Session de caisse introuvable.');
  if (session.status !== 'OPEN') {
    throw new ValidationError('Cette session de caisse est fermée.');
  }

  const input = parseOrThrow(cashMovementSchema, await readJson(request));

  const movement = await prisma.cashMovement.create({
    data: {
      cashSessionId: session.id,
      type: input.type,
      amount: input.amount,
      reason: input.reason ?? null,
      userId: context.user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CASH_MOVEMENT_RECORDED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'cash_movement',
    targetId: movement.id,
    metadata: { type: input.type, amount: input.amount },
  });

  return ok({ movement }, 201);
});
