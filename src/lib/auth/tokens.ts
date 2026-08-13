import { createHash, randomBytes } from 'node:crypto';

/**
 * Jetons opaques (session, vérification d'email, réinitialisation).
 *
 * Seul le *hash* est persisté. Une fuite de la base ne permet donc pas de
 * rejouer une session ni de réinitialiser un mot de passe : l'attaquant
 * obtiendrait des empreintes, pas les jetons.
 *
 * SHA-256 suffit ici, contrairement aux mots de passe : ces jetons font 256
 * bits d'entropie aléatoire, il n'y a pas d'espace de recherche à parcourir.
 */

export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const SESSION_TTL_DAYS = 30;
export const EMAIL_VERIFICATION_TTL_HOURS = 48;
export const PASSWORD_RESET_TTL_MINUTES = 60;

export function expiresIn(
  amount: number,
  unit: 'minutes' | 'hours' | 'days',
): Date {
  const ms = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[unit];
  return new Date(Date.now() + amount * ms);
}
