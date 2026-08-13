import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { findScopedOrThrow, requireTenant } from '@/lib/tenant';
import { reviewModerationSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const PATCH = route(async (request, { params }: Params) => {
  const context = await requireTenant('reviews:moderate');
  const { id } = await params;

  const existing = await findScopedOrThrow<{ id: string }>(
    'review',
    context.restaurant.id,
    id,
  );
  const input = parseOrThrow(reviewModerationSchema, await readJson(request));

  const review = await prisma.review.update({
    where: { id: existing.id },
    data: { status: input.status, moderatedAt: new Date() },
  });

  return ok({ review });
});
