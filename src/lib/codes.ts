import { randomInt } from 'node:crypto';

/** Code court à six chiffres, facile à lire et à dicter. */
export function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
