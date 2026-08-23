import { lookup } from 'node:dns/promises';

import { ValidationError } from '@/lib/errors';

/**
 * Garde-fou SSRF : un webhook pointe vers une URL choisie par le
 * commerçant, que notre serveur va appeler. Sans ce contrôle, n'importe
 * qui pourrait faire pointer un webhook vers une adresse interne
 * (localhost, réseau privé, métadonnées cloud) et se servir de notre
 * serveur pour sonder cette infrastructure.
 *
 * Vérifie l'IP réellement résolue au moment de l'enregistrement, pas
 * seulement l'apparence de l'hôte — mais reste une protection à
 * l'enregistrement, pas à chaque envoi : un hôte qui changerait de
 * résolution DNS après coup (rebinding) n'est pas re-vérifié à la
 * livraison. Acceptable pour une première version, à durcir si ce risque
 * devient concret.
 */
export async function assertPublicWebhookUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new ValidationError('Cette adresse n\'est pas autorisée.', { url: 'Hôte interne refusé.' });
  }

  let address: string;
  try {
    address = (await lookup(hostname)).address;
  } catch {
    throw new ValidationError("Impossible de résoudre cet hôte.", { url: 'Résolution DNS échouée.' });
  }

  if (isPrivateAddress(address)) {
    throw new ValidationError('Cette adresse n\'est pas autorisée.', { url: 'Adresse réseau privée refusée.' });
  }
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    );
  }

  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}
