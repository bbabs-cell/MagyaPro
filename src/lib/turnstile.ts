import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Vérifie un jeton Cloudflare Turnstile auprès de Cloudflare. N'échoue
 * jamais silencieusement : un jeton absent ou invalide lève, plutôt que de
 * laisser passer une requête non vérifiée.
 *
 * Si aucune clé secrète n'est configurée (développement local sans compte
 * Turnstile), la vérification est ignorée — la fonctionnalité est alors
 * simplement désactivée plutôt que de bloquer tout le monde.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<void> {
  if (!env.turnstileSecretKey) return;

  if (!token) {
    throw new ValidationError('Vérification anti-robot manquante. Rechargez la page et réessayez.');
  }

  const body = new URLSearchParams({
    secret: env.turnstileSecretKey,
    response: token,
    remoteip: ip,
  });

  const response = await fetch(VERIFY_URL, { method: 'POST', body });
  const result = (await response.json()) as { success: boolean };

  if (!result.success) {
    throw new ValidationError('Vérification anti-robot échouée. Rechargez la page et réessayez.');
  }
}
