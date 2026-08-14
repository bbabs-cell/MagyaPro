import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { restaurantProfileSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, diffFields, recordAudit } from '@/lib/audit';
import { currentClientIp } from '@/lib/auth/session';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('restaurant:view');
  return ok({ restaurant });
});

export const PATCH = route(async (request) => {
  const context = await requireTenant('restaurant:update');
  hit(`restaurant:${context.restaurant.id}`, RATE_LIMITS.write);

  const input = parseOrThrow(restaurantProfileSchema, await readJson(request));

  const before = {
    name: context.restaurant.name,
    description: context.restaurant.description,
    phone: context.restaurant.phone,
    email: context.restaurant.email,
    addressLine: context.restaurant.addressLine,
    city: context.restaurant.city,
    country: context.restaurant.country,
  };

  // `context.restaurant.id` provient de la session, jamais du corps de la
  // requête : c'est ce qui garantit qu'on ne modifie que son propre restaurant.
  const restaurant = await prisma.restaurant.update({
    where: { id: context.restaurant.id },
    data: {
      name: input.name,
      description: input.description ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      facebookUrl: input.facebookUrl ?? null,
      instagramUrl: input.instagramUrl ?? null,
      tiktokUrl: input.tiktokUrl ?? null,
      whatsappNumber: input.whatsappNumber ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.RESTAURANT_UPDATED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: restaurant.id,
    targetType: 'restaurant',
    targetId: restaurant.id,
    ip: await currentClientIp(),
    metadata: {
      section: 'profil',
      bySupport: context.isSupportAccess,
      changes: diffFields(before, {
        name: restaurant.name,
        description: restaurant.description,
        phone: restaurant.phone,
        email: restaurant.email,
        addressLine: restaurant.addressLine,
        city: restaurant.city,
        country: restaurant.country,
      }),
    },
  });

  return ok({ restaurant });
});
