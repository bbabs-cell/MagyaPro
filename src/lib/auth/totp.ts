import { randomInt } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';

/**
 * TOTP (RFC 6238) — authentification à deux facteurs par application
 * (Google Authenticator, Authy...). `otplib` fait tout le calcul
 * cryptographique ; ce fichier ne fait qu'adapter son API au vocabulaire du
 * projet et fixer les paramètres (tolérance d'horloge, format des codes de
 * secours).
 */

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildTotpUri(email: string, secret: string): string {
  return generateURI({ secret, label: email, issuer: 'MagyaPro' });
}

/** `epochTolerance: 1` accepte l'intervalle de 30 s précédent/suivant — une horloge de téléphone légèrement décalée ne doit pas bloquer la connexion. */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const token = code.trim();
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verify({ secret, token, epochTolerance: 1 });
  return result.valid;
}

const BACKUP_CODE_COUNT = 8;

/** Codes de secours à usage unique, au format lisible « XXXX-XXXX » (chiffres, pas d'ambiguïté à la saisie). */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const digits = Array.from({ length: 8 }, () => randomInt(0, 10)).join('');
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  });
}

/** Normalise un code de secours saisi (espaces, tiret facultatif) avant comparaison. */
export function normalizeBackupCode(code: string): string {
  const digits = code.replace(/[^0-9]/g, '');
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
}
