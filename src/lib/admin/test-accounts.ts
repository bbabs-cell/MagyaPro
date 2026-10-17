import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/**
 * Marquer un compte comme « compte de test » depuis le Super Admin — ou le
 * rendre aux chiffres.
 *
 * Un compte de test est exclu de la recette, des statistiques, des compteurs
 * d'abonnements et du nombre d'utilisateurs (voir `counted-accounts.ts`). Rien
 * d'autre ne change pour lui : son site, sa caisse, ses abonnements
 * fonctionnent comme avant. C'est toute la différence avec `isDemo`, qui le
 * rendrait public (vitrine de démonstration, visite libre) : un compte d'essai
 * interne ne doit jamais être exposé ainsi.
 *
 * Un compte de démonstration est déjà exclu : le marquer « test » en plus ne
 * voudrait rien dire, et le refus évite qu'on croie avoir changé quelque chose.
 */

type Actor = { id: string; email: string; ip: string | null };

export async function setRestaurantTestAccount(params: { restaurantId: string; isTest: boolean; actor: Actor }) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: { id: true, isDemo: true, isTest: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant introuvable.');
  if (restaurant.isDemo) {
    throw new ConflictError('Ce restaurant de démonstration est déjà exclu des chiffres.');
  }
  if (restaurant.isTest === params.isTest) return { isTest: restaurant.isTest };

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { isTest: params.isTest } });
  await recordAudit({
    action: params.isTest ? AUDIT_ACTIONS.RESTAURANT_TEST_MARKED : AUDIT_ACTIONS.RESTAURANT_TEST_UNMARKED,
    actorUserId: params.actor.id,
    actorEmail: params.actor.email,
    restaurantId: restaurant.id,
    targetType: 'restaurant',
    targetId: restaurant.id,
    ip: params.actor.ip,
  });
  return { isTest: params.isTest };
}

export async function setStoreTestAccount(params: { storeId: string; isTest: boolean; actor: Actor }) {
  const store = await prisma.store.findUnique({
    where: { id: params.storeId },
    select: { id: true, isDemo: true, isTest: true },
  });
  if (!store) throw new NotFoundError('Boutique introuvable.');
  if (store.isDemo) {
    throw new ConflictError('Cette boutique de démonstration est déjà exclue des chiffres.');
  }
  if (store.isTest === params.isTest) return { isTest: store.isTest };

  await prisma.store.update({ where: { id: store.id }, data: { isTest: params.isTest } });
  await recordAudit({
    action: params.isTest ? AUDIT_ACTIONS.STORE_TEST_MARKED : AUDIT_ACTIONS.STORE_TEST_UNMARKED,
    actorUserId: params.actor.id,
    actorEmail: params.actor.email,
    storeId: store.id,
    targetType: 'store',
    targetId: store.id,
    ip: params.actor.ip,
  });
  return { isTest: params.isTest };
}
