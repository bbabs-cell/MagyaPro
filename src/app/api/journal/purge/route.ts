import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';

/** Purge du journal au-delà de douze mois — geste volontaire, sans automatisme. */
export const POST = route(async () => {
  const { restaurant } = await requireTenant('audit:view');

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const result = await prisma.auditLog.deleteMany({
    where: { restaurantId: restaurant.id, createdAt: { lt: cutoff } },
  });

  return ok({ deleted: result.count });
});
