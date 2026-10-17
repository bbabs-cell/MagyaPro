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

/**
 * Vérifie un code TOTP et rend sa fenêtre de 30 s (`timeStep`), ou `null`.
 *
 * Tolérance : `epochTolerance` est exprimée en **secondes** dans otplib 13,
 * pas en fenêtres. La valeur `1` qui figurait ici ne tolérait donc qu'une
 * seconde de décalage : un code tapé juste après le changement de fenêtre,
 * ou depuis un téléphone dont l'horloge retarde de quelques secondes, était
 * refusé — alors que le commentaire promettait une fenêtre de part et
 * d'autre. 30 s rétablit ce qui était voulu.
 *
 * `afterTimeStep` : toute fenêtre inférieure ou égale est refusée. C'est ce
 * qui rend un code à usage unique (voir `service.ts`).
 */
export async function checkTotpCode(
  secret: string,
  code: string,
  afterTimeStep?: number,
): Promise<number | null> {
  const token = code.trim();
  if (!/^\d{6}$/.test(token)) return null;
  const result = await verify({ secret, token, epochTolerance: 30, afterTimeStep });
  return result.valid && 'timeStep' in result ? result.timeStep : null;
}

/** Variante sans mémoire de l'usage : enrôlement, où le code n'ouvre aucune session. */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  return (await checkTotpCode(secret, code)) !== null;
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
