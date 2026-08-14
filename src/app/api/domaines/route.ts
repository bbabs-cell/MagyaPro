import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { domainSchema } from '@/lib/validation';
import { ConflictError, ValidationError } from '@/lib/errors';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';
import { generateToken } from '@/lib/auth/tokens';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { rootHostname } from '@/lib/env';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('domains:manage');
  const domains = await prisma.domain.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: 'asc' },
  });
  return ok({ domains });
});

export const POST = route(async (request) => {
  const context = await requireTenant('domains:manage');

  const entitlements = await getEntitlements(context.restaurant.id);
  requireFeature(entitlements, FEATURES.CUSTOM_DOMAIN);

  const { hostname } = parseOrThrow(domainSchema, await readJson(request));

  // Un sous-domaine de la plateforme est attribué automatiquement, il ne peut
  // pas être revendiqué comme domaine personnalisé.
  if (hostname === rootHostname() || hostname.endsWith(`.${rootHostname()}`)) {
    throw new ValidationError(
      `Les domaines en ${rootHostname()} sont attribués automatiquement et ne peuvent pas être ajoutés ici.`,
      { hostname: 'Domaine réservé à la plateforme.' },
    );
  }

  // `hostname` est unique au niveau de la plateforme : deux restaurants ne
  // peuvent pas revendiquer la même adresse.
  const taken = await prisma.domain.findUnique({
    where: { hostname },
    select: { restaurantId: true },
  });
  if (taken) {
    throw new ConflictError(
      taken.restaurantId === context.restaurant.id
        ? 'Ce domaine est déjà enregistré sur votre restaurant.'
        : 'Ce domaine est déjà utilisé.',
    );
  }

  const domain = await prisma.domain.create({
    data: {
      restaurantId: context.restaurant.id,
      hostname,
      type: 'CUSTOM',
      status: 'PENDING',
      verificationToken: `magyapro-verify-${generateToken(16)}`,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.DOMAIN_ADDED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    restaurantId: context.restaurant.id,
    targetType: 'domain',
    targetId: domain.id,
    metadata: { hostname },
  });

  return ok({ domain }, 201);
});
