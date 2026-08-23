import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ConflictError } from '@/lib/errors';
import { planSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

export const GET = route(async () => {
  await requireSuperAdmin();
  const plans = await prisma.plan.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });
  return ok({ plans });
});

/**
 * Création d'un plan.
 *
 * Les prix et les limites vivent en base : ajouter une offre ou modifier un
 * tarif ne demande aucun déploiement, et la landing page comme le dashboard
 * s'alignent automatiquement.
 */
export const POST = route(async (request) => {
  const admin = await requireSuperAdmin();
  const input = parseOrThrow(planSchema, await readJson(request));

  const existing = await prisma.plan.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('Un plan porte déjà cette clé.');
  }

  const plan = await prisma.plan.create({
    data: {
      key: input.key,
      product: input.product,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      currency: input.currency,
      interval: input.interval,
      trialDays: input.trialDays,
      features: input.features,
      limits: input.limits as never,
      isActive: input.isActive,
      position: input.position,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PLAN_CREATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'plan',
    targetId: plan.id,
    metadata: { key: plan.key, price: plan.price },
  });

  return ok({ plan }, 201);
});
