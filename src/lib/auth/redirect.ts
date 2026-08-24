import { prisma } from '@/lib/db';
import { rootHostname } from '@/lib/env';
import { ForbiddenError } from '@/lib/errors';
import type { User } from '@prisma/client';

/**
 * Destination après connexion — dépend du produit d'où vient la requête
 * (l'hôte) et de l'état du compte sur ce produit. Partagée entre la
 * connexion directe (`/api/auth/login`) et la validation du second facteur
 * (`/api/auth/2fa/verify-login`), qui doivent aboutir exactement au même
 * endroit une fois l'utilisateur authentifié.
 *
 * Un compte sans adhésion sur le produit visé par l'hôte (ex. un compte
 * Restaurant qui se connecte sur boutique.magyapro.com) est refusé ici plutôt
 * que renvoyé vers un tableau de bord vide : ce dashboard le redirigerait
 * lui-même vers l'onboarding, qui le renverrait vers la connexion — une
 * boucle infinie côté client, sans session valable pour en sortir.
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
    if (!membership) {
      throw new ForbiddenError(
        "Ce compte n'est associé à aucune boutique. Si vous avez un compte MagyaPro Restaurant, connectez-vous depuis magyapro.com.",
      );
    }
    return membership.store.onboardingCompletedAt ? '/boutique/dashboard' : '/boutique/bienvenue';
  }

  const membership = await prisma.restaurantUser.findFirst({
    where: { userId: user.id },
    select: { restaurant: { select: { onboardingCompletedAt: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) {
    throw new ForbiddenError(
      "Ce compte n'est associé à aucun restaurant. Si vous avez un compte MagyaPro Boutique, connectez-vous depuis boutique.magyapro.com.",
    );
  }
  return membership.restaurant.onboardingCompletedAt ? '/dashboard' : '/bienvenue';
}
