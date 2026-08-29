import type { Prisma, Store } from '@prisma/client';

import { prisma } from '@/lib/db';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { ForbiddenError } from '@/lib/errors';
import { uniqueStoreSlug } from '@/lib/slug';
import { seedStoreUnits } from '@/lib/boutique/units-engine';

/**
 * Création d'une boutique, sans création de compte.
 *
 * Deux chemins y mènent et doivent produire exactement la même boutique :
 * l'inscription (`registerStoreAccount`, qui crée aussi l'utilisateur) et
 * l'ajout d'une boutique par un propriétaire déjà connecté. Les faire diverger
 * donnerait des boutiques sans point de vente ou sans caisse selon la porte
 * empruntée, avec des symptômes incompréhensibles des mois plus tard.
 *
 * Ce module ne s'occupe ni de l'abonnement ni du paiement : l'inscription
 * ouvre une période d'essai, l'ajout d'une boutique n'en ouvre pas. Cette
 * différence est la règle de facturation, elle reste chez l'appelant.
 */
export async function scaffoldStore(
  tx: Prisma.TransactionClient,
  params: {
    name: string;
    slug: string;
    /** Compte facturé pour cette boutique — voir `Store.ownerAccountId`. */
    ownerAccountId: string;
    /** Compte inscrit comme propriétaire dans l'équipe. */
    memberUserId: string;
  },
): Promise<Store> {
  const store = await tx.store.create({
    data: {
      name: params.name,
      slug: params.slug,
      status: 'DRAFT',
      ownerAccountId: params.ownerAccountId,
      members: { create: { userId: params.memberUserId, role: 'OWNER' } },
    },
  });

  // Le point de vente principal, créé d'office : une boutique doit toujours
  // avoir au moins un emplacement pour recevoir du stock.
  await tx.warehouse.create({
    data: { storeId: store.id, name: 'Boutique principale', isDefault: true },
  });

  // Idem pour la caisse : sans elle, impossible d'ouvrir une session de caisse
  // le jour où le commerçant en a besoin.
  await tx.cashRegister.create({
    data: { storeId: store.id, name: 'Caisse principale' },
  });

  // Jeu d'unités de départ. Le secteur n'est choisi qu'à l'étape suivante
  // (onboarding), d'où le profil générique ici — l'onboarding complètera avec
  // les unités du métier retenu, sans jamais toucher à celles-ci.
  await seedStoreUnits(store.id, store.businessType, tx);

  return store;
}

/**
 * Ouvre une boutique supplémentaire pour un compte déjà propriétaire.
 *
 * Aucune période d'essai et aucun abonnement : la boutique naît sans plan,
 * donc en lecture seule (voir `NO_PLAN` dans `entitlements.ts`). Elle
 * n'encaisse qu'une fois son paiement majoré validé. Sans cette règle, ouvrir
 * une boutique de plus offrirait un mois gratuit à chaque fois, indéfiniment.
 *
 * Réservé aux comptes qui possèdent déjà au moins une boutique : un employé
 * n'ouvre pas de boutique au nom de son patron, et un compte sans boutique
 * passe par l'inscription, qui a droit à l'essai.
 */
export async function createAdditionalStore(params: {
  userId: string;
  userEmail: string;
  name: string;
  ip?: string | null;
}): Promise<Store> {
  const owned = await prisma.storeUser.count({
    where: { userId: params.userId, role: 'OWNER' },
  });
  if (owned === 0) {
    throw new ForbiddenError('Seul le propriétaire d’une boutique peut en ouvrir une autre.');
  }

  const slug = await uniqueStoreSlug(params.name);

  const store = await prisma.$transaction((tx) =>
    scaffoldStore(tx, {
      name: params.name,
      slug,
      ownerAccountId: params.userId,
      memberUserId: params.userId,
    }),
  );

  await recordAudit({
    action: AUDIT_ACTIONS.STORE_CREATED,
    actorUserId: params.userId,
    actorEmail: params.userEmail,
    storeId: store.id,
    targetType: 'store',
    targetId: store.id,
    ip: params.ip,
    metadata: { additional: true },
  });

  return store;
}
