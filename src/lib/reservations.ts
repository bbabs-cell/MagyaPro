import type { Prisma } from '@prisma/client';

import { generateToken, hashToken } from '@/lib/auth/tokens';
import { generateSixDigitCode } from '@/lib/codes';

/**
 * Code de confirmation de réservation.
 *
 * Six chiffres, faciles à lire et à dicter au téléphone ou à présenter à
 * l'accueil du restaurant — pas un identifiant technique.
 */
export function generateReservationCode(): string {
  return generateSixDigitCode();
}

/**
 * Clé du lien de suivi d'une réservation.
 *
 * Le lien portait l'identifiant de la réservation, un `cuid()` v1 : il n'est
 * pas énumérable, mais il n'est pas non plus un aléa cryptographique — une
 * part en est l'horodatage et un compteur. Or ce lien permet d'**annuler** la
 * réservation, sans compte. Il porte désormais 32 octets tirés de
 * `crypto.randomBytes`, dont seule l'empreinte est conservée.
 */
export function createReservationAccess(): { key: string; hash: string } {
  const key = generateToken(32);
  return { key, hash: hashToken(key) };
}

/**
 * Filtre « la réservation que ce lien désigne ». Une réservation créée avant
 * l'introduction des clés (`accessTokenHash` vide) reste joignable par son
 * identifiant, pour ne pas casser les liens déjà envoyés ; une réservation
 * récente ne l'est **que** par sa clé.
 */
export function reservationAccessWhere(key: string): Prisma.ReservationWhereInput {
  return { OR: [{ accessTokenHash: hashToken(key) }, { id: key, accessTokenHash: null }] };
}
