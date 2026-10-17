import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { domainSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';
import { FEATURES, getEntitlements, requireFeature } from '@/lib/entitlements';
import { claimCustomDomain } from '@/lib/domain-claims';
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

  // Un domaine en attente ne bloque plus personne — voir `claimCustomDomain`.
  const domain = await claimCustomDomain({
    restaurantId: context.restaurant.id,
    hostname,
    actor: { id: context.user.id, email: context.user.email },
  });

  return ok({ domain }, 201);
});
