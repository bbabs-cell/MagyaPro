import { prisma } from '@/lib/db';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { UnauthorizedError } from '@/lib/errors';
import type { Store } from '@prisma/client';

/**
 * Authentification de l'API publique en lecture seule (`/api/v1/*`) — par
 * clé d'API, jamais par la session du tableau de bord : ces routes sont
 * faites pour être appelées depuis un service externe, sans navigateur.
 *
 * Même principe que les sessions (`auth/tokens.ts`) : seule l'empreinte de
 * la clé est en base, la valeur en clair n'est jamais récupérable après sa
 * création.
 */

const KEY_PREFIX = 'mpk_';

export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `${KEY_PREFIX}${generateToken(24)}`;
  return { key, keyHash: hashToken(key), keyPrefix: key.slice(0, 12) };
}

export async function requireApiKeyStore(request: Request): Promise<Store> {
  const auth = request.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer (.+)$/);
  const key = match?.[1]?.trim();
  if (!key) {
    throw new UnauthorizedError("Clé d'API manquante — en-tête Authorization: Bearer <clé> requis.");
  }

  const apiKey = await prisma.storeApiKey.findUnique({
    where: { keyHash: hashToken(key) },
    include: { store: true },
  });

  if (!apiKey || apiKey.revokedAt || apiKey.store.status !== 'ACTIVE') {
    throw new UnauthorizedError("Clé d'API invalide ou révoquée.");
  }

  // Best-effort : un échec de cette mise à jour ne doit jamais bloquer la requête.
  prisma.storeApiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return apiKey.store;
}
