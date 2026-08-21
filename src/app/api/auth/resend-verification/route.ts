import { ok, route } from '@/lib/api';
import { resendVerificationEmail } from '@/lib/auth/service';
import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError } from '@/lib/errors';
import { RATE_LIMITS, hit } from '@/lib/rate-limit';

export const POST = route(async () => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  hit(`resend-verification:${user.id}`, RATE_LIMITS.emailVerificationResend);

  if (!user.emailVerifiedAt) {
    await resendVerificationEmail(user);
  }

  // Réponse identique que l'email ait été renvoyé ou que le compte soit déjà
  // vérifié : rien à distinguer côté client, l'utilisateur voit son adresse
  // confirmée dès qu'il clique sur le lien reçu.
  return ok({
    message: 'Un nouvel email de vérification vient de vous être envoyé.',
  });
});
