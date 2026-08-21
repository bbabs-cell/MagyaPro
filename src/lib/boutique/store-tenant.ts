import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Store, StoreRole } from '@prisma/client';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/errors';
import { effectiveStorePermissions, type StorePermission } from '@/lib/boutique/rbac';
import { getCurrentUser, requiresEmailVerification, type SessionUser } from '@/lib/auth/session';

/**
 * Résolution du tenant MagyaPro Boutique — équivalent de `src/lib/tenant.ts`
 * pour Restaurant, jamais partagé avec lui : une boutique ne doit pouvoir
 * accéder ni aux données ni au contexte d'un restaurant, et réciproquement.
 *
 * Principe non négociable, identique à Restaurant : la boutique active est
 * déterminée **côté serveur** à partir de l'utilisateur authentifié. Le
 * client peut demander à basculer vers une boutique (cookie
 * `magyapro_store`), mais cette demande n'est honorée qu'après vérification
 * qu'une adhésion existe réellement. Un `storeId` reçu dans un corps de
 * requête n'est jamais utilisé pour choisir le tenant.
 */
export const ACTIVE_STORE_COOKIE = 'magyapro_store';

export type StoreContext = {
  user: SessionUser;
  store: Store;
  role: StoreRole;
  permissions: Set<StorePermission>;
};

/** Adhésions de l'utilisateur, pour le sélecteur de boutique. */
export const listStoreMemberships = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.storeUser.findMany({
    where: { userId: user.id },
    select: {
      role: true,
      store: {
        select: { id: true, name: true, slug: true, logoUrl: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
});

/**
 * Contexte tenant de la requête courante, ou `null` si l'utilisateur n'a
 * accès à aucune boutique.
 *
 * Contrairement à `getTenantContext` (Restaurant), il n'y a pas encore de
 * voie d'accès support Super Admin ici — elle arrivera avec la Phase Super
 * Admin de MagyaPro Boutique, en suivant exactement le même principe
 * (journalisé, révocable, limité).
 */
export const getStoreContext = cache(async (): Promise<StoreContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  // Le cookie n'est qu'une *préférence* : la clause `userId` garantit qu'un
  // identifiant forgé ne donne accès à rien.
  const membership =
    (requestedId
      ? await prisma.storeUser.findFirst({
          where: { userId: user.id, storeId: requestedId },
          include: { store: true },
        })
      : null) ??
    (await prisma.storeUser.findFirst({
      where: { userId: user.id },
      include: { store: true },
      orderBy: { createdAt: 'asc' },
    }));

  if (!membership) return null;

  return {
    user,
    store: membership.store,
    role: membership.role,
    permissions: effectiveStorePermissions(membership.role, membership.extraPermissions),
  };
});

/**
 * Contexte tenant obligatoire, avec vérification de permission.
 * Toute route de dashboard et toute API MagyaPro Boutique passe par ici.
 */
export async function requireStore(permission?: StorePermission): Promise<StoreContext> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  // Défense en profondeur : la page du tableau de bord redirige déjà les
  // comptes non vérifiés vers `/verifier-email`, mais un appel direct à
  // l'API (sans passer par cette page) doit être bloqué tout autant.
  if (requiresEmailVerification(user)) {
    throw new ForbiddenError('Vérifiez votre adresse email avant de continuer.');
  }

  const context = await getStoreContext();
  if (!context) {
    throw new NotFoundError("Aucune boutique n'est associée à votre compte.");
  }

  // Une boutique suspendue reste consultable par son équipe — sans quoi elle
  // ne pourrait ni comprendre la situation ni régulariser — mais toute
  // écriture est bloquée.
  if (
    context.store.status === 'SUSPENDED' &&
    permission &&
    permission !== 'store:view' &&
    permission !== 'subscription:view' &&
    permission !== 'subscription:manage'
  ) {
    throw new ForbiddenError(
      'Cette boutique est suspendue. Régularisez votre abonnement pour reprendre la main.',
    );
  }

  if (permission && !context.permissions.has(permission)) {
    throw new ForbiddenError();
  }

  return context;
}

export function canStore(context: StoreContext, permission: StorePermission): boolean {
  return context.permissions.has(permission);
}

/**
 * Bascule la boutique active. Refuse si l'utilisateur n'y est pas membre :
 * c'est ce contrôle, et non le cookie, qui protège l'isolation.
 */
export async function setActiveStore(storeId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const membership = await prisma.storeUser.findFirst({
    where: { userId: user.id, storeId },
    select: { id: true },
  });
  if (!membership) throw new NotFoundError();

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
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
 * Le filtre `storeId` fait partie de la *requête*, il n'est pas vérifié
 * après coup : une ressource d'une autre boutique n'est jamais chargée en
 * mémoire, et la réponse est un 404 indiscernable d'un identifiant inexistant.
 */
type StoreScopedModel =
  | 'brand'
  | 'storeCategory'
  | 'storeProduct'
  | 'warehouse'
  | 'supplier'
  | 'supplierPayment'
  | 'purchaseOrder'
  | 'storeCustomer'
  | 'storeCreditPayment'
  | 'sale'
  | 'storeReturn'
  | 'cashRegister'
  | 'storeExpense'
  | 'invoice'
  | 'storePromotion'
  | 'inventoryMovement';

export async function findStoreScopedOrThrow<T>(
  model: StoreScopedModel,
  storeId: string,
  id: string,
  options: { include?: unknown; select?: unknown } = {},
): Promise<T> {
  const delegate = prisma[model] as {
    findFirst: (args: unknown) => Promise<T | null>;
  };

  const record = await delegate.findFirst({
    where: { id, storeId },
    ...options,
  });

  if (!record) throw new NotFoundError();
  return record;
}
