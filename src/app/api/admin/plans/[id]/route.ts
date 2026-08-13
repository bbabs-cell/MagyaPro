import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { planSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Plan introuvable.');

  const input = parseOrThrow(planSchema, await readJson(request));

  const plan = await prisma.plan.update({
    where: { id: existing.id },
    data: {
      key: input.key,
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
    action: AUDIT_ACTIONS.PLAN_UPDATED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'plan',
    targetId: plan.id,
    metadata: { key: plan.key, price: plan.price },
  });

  return ok({ plan });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;

  const plan = await prisma.plan.findUnique({
    where: { id },
    select: { id: true, key: true, _count: { select: { subscriptions: true } } },
  });
  if (!plan) throw new NotFoundError('Plan introuvable.');

  // Supprimer un plan souscrit laisserait des restaurants sans droits d'un
  // instant à l'autre. On oriente vers la désactivation, qui retire le plan de
  // la vente sans toucher aux abonnements en cours.
  if (plan._count.subscriptions > 0) {
    throw new ConflictError(
      `${plan._count.subscriptions} restaurant${plan._count.subscriptions > 1 ? 's sont abonnés' : ' est abonné'} à ce plan. Désactivez-le plutôt que de le supprimer.`,
    );
  }

  await prisma.plan.delete({ where: { id: plan.id } });

  await recordAudit({
    action: AUDIT_ACTIONS.PLAN_DELETED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetType: 'plan',
    targetId: plan.id,
    metadata: { key: plan.key },
  });

  return ok({ deleted: true });
});
