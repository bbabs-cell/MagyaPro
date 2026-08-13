import { randomInt } from 'node:crypto';

/**
 * Code de confirmation de réservation.
 *
 * Six chiffres, faciles à lire et à dicter au téléphone ou à présenter à
 * l'accueil du restaurant — pas un identifiant technique.
 */
export function generateReservationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
