import { cache } from 'react';
import { cookies } from 'next/headers';
import type { MembershipRole, Restaurant } from '@prisma/client';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/errors';
import { effectivePermissions, type Permission } from '@/lib/rbac';
import { getCurrentUser, SUPPORT_COOKIE, type SessionUser } from '@/lib/auth/session';

/**
 * Résolution du tenant.
 *
 * Principe non négociable : le restaurant actif est déterminé **côté serveur**
 * à partir de l'utilisateur authentifié. Le client peut demander à basculer
 * vers un restaurant (cookie `magyapro_restaurant`), mais cette demande n'est
 * honorée qu'après vérification qu'une adhésion existe réellement. Un
 * `restaurantId` reçu dans un corps de requête n'est jamais utilisé pour
 * choisir le tenant.
 */
export const ACTIVE_RESTAURANT_COOKIE = 'magyapro_restaurant';

export type TenantContext = {
  user: SessionUser;
  restaurant: Restaurant;
  /** `null` quand l'accès provient d'une session de support Super Admin. */
  role: MembershipRole | null;
  permissions: Set<Permission>;
  /** Vrai si un Super Admin consulte l'espace sans en être membre. */
  isSupportAccess: boolean;
  supportAccessId: string | null;
};

/** Adhésions de l'utilisateur, pour le sélecteur de restaurant. */
export const listMemberships = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.restaurantUser.findMany({
    where: { userId: user.id },
    select: {
      role: true,
      restaurant: {
        select: { id: true, name: true, slug: true, logoUrl: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
});

/**
 * Contexte tenant de la requête courante, ou `null` si l'utilisateur n'a accès
 * à aucun restaurant.
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();

  // --- Voie 1 : accès support d'un Super Admin -----------------------------
  // Elle est examinée en premier car un Super Admin peut aussi être membre
  // d'un restaurant : tant qu'une session de support est ouverte, c'est elle
  // qui prime, pour que le journal d'audit reflète l'accès réel.
  const supportAccessId = cookieStore.get(SUPPORT_COOKIE)?.value;
  if (supportAccessId && user.platformRole === 'SUPER_ADMIN') {
    const access = await prisma.supportAccess.findFirst({
      where: { id: supportAccessId, adminUserId: user.id, endedAt: null },
      include: { restaurant: true },
    });
    if (access) {
      return {
        user,
        restaurant: access.restaurant,
        role: null,
        // Le support dispose des droits de lecture et d'intervention, mais pas
        // de la suppression du restaurant ni de la gestion de l'abonnement :
        // ces actions engagent le client, pas l'assistance.
        permissions: SUPPORT_PERMISSIONS,
        isSupportAccess: true,
        supportAccessId: access.id,
      };
    }
  }

  // --- Voie 2 : adhésion réelle -------------------------------------------
  const requestedId = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;

  // Le cookie n'est qu'une *préférence* : la clause `userId` garantit qu'un
  // identifiant forgé ne donne accès à rien.
  const membership =
    (requestedId
      ? await prisma.restaurantUser.findFirst({
          where: { userId: user.id, restaurantId: requestedId },
          include: { restaurant: true },
        })
      : null) ??
    (await prisma.restaurantUser.findFirst({
      where: { userId: user.id },
      include: { restaurant: true },
      orderBy: { createdAt: 'asc' },
    }));

  if (!membership) return null;

  return {
    user,
    restaurant: membership.restaurant,
    role: membership.role,
    permissions: effectivePermissions(membership.role, membership.extraPermissions),
    isSupportAccess: false,
    supportAccessId: null,
  };
});

const SUPPORT_PERMISSIONS = new Set<Permission>([
  'restaurant:view',
  'restaurant:update',
  'menu:view',
  'menu:manage',
  'orders:view',
  'orders:update_status',
  'orders:cancel',
  'customers:view',
  'delivery:manage',
  'promotions:manage',
  'payments:view',
  'analytics:view',
  'team:view',
  'settings:manage',
  'subscription:view',
  'domains:manage',
]);

/**
 * Contexte tenant obligatoire, avec vérification de permission.
 * Toute route de dashboard et toute API tenant passe par ici.
 */
export async function requireTenant(
  permission?: Permission,
): Promise<TenantContext> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const context = await getTenantContext();
  if (!context) {
    throw new NotFoundError(
      "Aucun restaurant n'est associé à votre compte.",
    );
  }

  // Un restaurant suspendu reste consultable par son équipe — sans quoi le
  // client ne pourrait ni comprendre la situation ni régulariser — mais toute
  // écriture est bloquée.
  if (
    context.restaurant.status === 'SUSPENDED' &&
    permission &&
    permission !== 'restaurant:view' &&
    permission !== 'subscription:view' &&
    permission !== 'subscription:manage' &&
    !context.isSupportAccess
  ) {
    throw new ForbiddenError(
      'Ce restaurant est suspendu. Régularisez votre abonnement pour reprendre la main.',
    );
  }

  if (permission && !context.permissions.has(permission)) {
    throw new ForbiddenError();
  }

  return context;
}

export function can(context: TenantContext, permission: Permission): boolean {
  return context.permissions.has(permission);
}

/**
 * Bascule le restaurant actif. Refuse si l'utilisateur n'y est pas membre :
 * c'est ce contrôle, et non le cookie, qui protège l'isolation.
 */
export async function setActiveRestaurant(restaurantId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const membership = await prisma.restaurantUser.findFirst({
    where: { userId: user.id, restaurantId },
    select: { id: true },
  });
  if (!membership) throw new NotFoundError();

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Charge une ressource en imposant l'appartenance au tenant.
 *
 * Le filtre `restaurantId` fait partie de la *requête*, il n'est pas vérifié
 * après coup : une ressource d'un autre restaurant n'est jamais chargée en
 * mémoire, et la réponse est un 404 indiscernable d'un identifiant inexistant.
 */
type TenantScopedModel =
  | 'category'
  | 'product'
  | 'order'
  | 'customer'
  | 'deliveryZone'
  | 'promotion'
  | 'payment'
  | 'domain'
  | 'review'
  | 'reservation'
  | 'restaurantTable'
  | 'loyaltyTier'
  | 'expense'
  | 'galleryImage';

export async function findScopedOrThrow<T>(
  model: TenantScopedModel,
  restaurantId: string,
  id: string,
  options: { include?: unknown; select?: unknown } = {},
): Promise<T> {
  const delegate = prisma[model] as {
    findFirst: (args: unknown) => Promise<T | null>;
  };

  const record = await delegate.findFirst({
    where: { id, restaurantId },
    ...options,
  });

  if (!record) throw new NotFoundError();
  return record;
}
