import { prisma } from '@/lib/db';
import { rootHostname } from '@/lib/env';
import type { User } from '@prisma/client';

/**
 * Destination après connexion — dépend du produit d'où vient la requête
 * (l'hôte) et de l'état du compte sur ce produit. Partagée entre la
 * connexion directe (`/api/auth/login`) et la validation du second facteur
 * (`/api/auth/2fa/verify-login`), qui doivent aboutir exactement au même
 * endroit une fois l'utilisateur authentifié.
 */
export async function resolveLoginRedirect(user: User, host: string): Promise<string> {
  const isBoutiqueHost = host === `boutique.${rootHostname()}`;

  if (user.platformRole === 'SUPER_ADMIN') return '/admin';

  if (isBoutiqueHost) {
    const membership = await prisma.storeUser.findFirst({
      where: { userId: user.id },
      select: { store: { select: { onboardingCompletedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return membership && !membership.store.onboardingCompletedAt
      ? '/boutique/bienvenue'
      : '/boutique/dashboard';
  }

  const membership = await prisma.restaurantUser.findFirst({
    where: { userId: user.id },
    select: { restaurant: { select: { onboardingCompletedAt: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return membership && !membership.restaurant.onboardingCompletedAt ? '/bienvenue' : '/dashboard';
}
