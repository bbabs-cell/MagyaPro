import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { STORE_FEATURES, getStoreEntitlements, requireStoreFeature } from '@/lib/boutique/entitlements';
import { domainSchema } from '@/lib/validation';
import { ConflictError, ValidationError } from '@/lib/errors';
import { generateToken } from '@/lib/auth/tokens';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { rootHostname } from '@/lib/env';

/** Domaines personnalisés d'une boutique — miroir de `/api/domaines` (Restaurant). */
export const GET = route(async () => {
  const { store } = await requireStore('settings:manage');
  const domains = await prisma.storeDomain.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'asc' },
  });
  return ok({ domains });
});

export const POST = route(async (request) => {
  const context = await requireStore('settings:manage');

  const entitlements = await getStoreEntitlements(context.store.id);
  requireStoreFeature(entitlements, STORE_FEATURES.CUSTOM_DOMAIN);

  const { hostname } = parseOrThrow(domainSchema, await readJson(request));

  // Un sous-domaine de la plateforme est attribué automatiquement, il ne peut
  // pas être revendiqué comme domaine personnalisé.
  if (hostname === rootHostname() || hostname.endsWith(`.${rootHostname()}`)) {
    throw new ValidationError(
      `Les domaines en ${rootHostname()} sont attribués automatiquement et ne peuvent pas être ajoutés ici.`,
      { hostname: 'Domaine réservé à la plateforme.' },
    );
  }

  // `hostname` est unique au niveau de la plateforme : deux boutiques ne
  // peuvent pas revendiquer la même adresse.
  const taken = await prisma.storeDomain.findUnique({
    where: { hostname },
    select: { storeId: true },
  });
  if (taken) {
    throw new ConflictError(
      taken.storeId === context.store.id
        ? 'Ce domaine est déjà enregistré sur votre boutique.'
        : 'Ce domaine est déjà utilisé.',
    );
  }

  const domain = await prisma.storeDomain.create({
    data: {
      storeId: context.store.id,
      hostname,
      type: 'CUSTOM',
      status: 'PENDING',
      verificationToken: `magyapro-verify-${generateToken(16)}`,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_DOMAIN_ADDED,
    actorUserId: context.user.id,
    actorEmail: context.user.email,
    storeId: context.store.id,
    targetType: 'store_domain',
    targetId: domain.id,
    metadata: { hostname },
  });

  return ok({ domain }, 201);
});
