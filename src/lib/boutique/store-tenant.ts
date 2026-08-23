import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Store, StoreRole } from '@prisma/client';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/errors';
import { effectiveStorePermissions, type StorePermission } from '@/lib/boutique/rbac';
import {
  getCurrentUser,
  requiresEmailVerification,
  SUPPORT_STORE_COOKIE,
  type SessionUser,
} from '@/lib/auth/session';

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
  /** `null` quand l'accès provient d'une session de support Super Admin. */
  role: StoreRole | null;
  permissions: Set<StorePermission>;
  /** Vrai si un Super Admin consulte l'espace sans en être membre. */
  isSupportAccess: boolean;
  supportAccessId: string | null;
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

const SUPPORT_STORE_PERMISSIONS = new Set<StorePermission>([
  'store:view',
  'store:update',
  'store:publish',
  'products:view',
  'products:manage',
  'inventory:view',
  'inventory:manage',
  'inventory:transfer',
  'purchases:view',
  'purchases:manage',
  'suppliers:view',
  'suppliers:manage',
  'pos:access',
  'sales:view',
  'sales:refund',
  'cash:manage',
  'customers:view',
  'customers:manage',
  'credits:manage',
  'expenses:manage',
  'finances:view',
  'promotions:manage',
  'invoices:view',
  'reports:view',
  'analytics:view',
  'employees:view',
  'audit:view',
  'settings:manage',
  'subscription:view',
]);

/**
 * Contexte tenant de la requête courante, ou `null` si l'utilisateur n'a
 * accès à aucune boutique.
 */
export const getStoreContext = cache(async (): Promise<StoreContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();

  // --- Voie 1 : accès support d'un Super Admin -----------------------------
  // Examinée en premier car un Super Admin peut aussi être membre d'une
  // boutique : tant qu'une session de support est ouverte, c'est elle qui
  // prime, pour que le journal d'audit reflète l'accès réel.
  const supportAccessId = cookieStore.get(SUPPORT_STORE_COOKIE)?.value;
  if (supportAccessId && user.platformRole === 'SUPER_ADMIN') {
    const access = await prisma.storeSupportAccess.findFirst({
      where: { id: supportAccessId, adminUserId: user.id, endedAt: null },
      include: { store: true },
    });
    if (access) {
      return {
        user,
        store: access.store,
        role: null,
        // Le support dispose des droits de lecture et d'intervention, mais
        // pas de la suppression de la boutique ni de la gestion de
        // l'abonnement : ces actions engagent le client, pas l'assistance.
        permissions: SUPPORT_STORE_PERMISSIONS,
        isSupportAccess: true,
        supportAccessId: access.id,
      };
    }
  }

  // --- Voie 2 : adhésion réelle -------------------------------------------
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
    isSupportAccess: false,
    supportAccessId: null,
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
    permission !== 'subscription:manage' &&
    !context.isSupportAccess
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
  | 'inventoryMovement'
  | 'storeOrder';

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
