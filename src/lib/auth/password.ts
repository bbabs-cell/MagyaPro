import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Hachage des mots de passe par scrypt (RFC 7914), disponible nativement dans
 * Node : pas de dépendance native à compiler, et une fonction délibérément
 * coûteuse en mémoire, donc résistante aux attaques par GPU/ASIC.
 *
 * Les paramètres sont stockés dans le hash lui-même, ce qui permettra de les
 * durcir plus tard sans invalider les mots de passe existants.
 */
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const PASSWORD_MIN_LENGTH = 8;

/** Format : scrypt$N$r$p$<salt base64>$<clé base64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Vérifie un mot de passe. La comparaison est à temps constant : une
 * comparaison naïve fuirait le nombre d'octets corrects par son temps
 * d'exécution.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nRaw, rRaw, pRaw, saltB64, keyB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let expected: Buffer;
  try {
    expected = Buffer.from(keyB64!, 'base64');
  } catch {
    return false;
  }

  const derived = await scrypt(
    password.normalize('NFKC'),
    Buffer.from(saltB64!, 'base64'),
    expected.length,
    { N, r, p, maxmem: 64 * 1024 * 1024 },
  );

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Politique de mot de passe. Volontairement simple : la longueur est le
 * facteur qui compte le plus, imposer des classes de caractères pousse surtout
 * les utilisateurs vers « Motdepasse1! ».
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (password.length > 200) {
    return 'Le mot de passe ne peut pas dépasser 200 caractères.';
  }
  if (/^\s+$/.test(password)) {
    return 'Le mot de passe ne peut pas être composé uniquement d\'espaces.';
  }
  return null;
}
