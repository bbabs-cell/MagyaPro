import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique, via l'adaptateur `pg` plutôt que le moteur binaire
 * par défaut de Prisma.
 *
 * Nécessaire pour tourner sur Cloudflare Workers (runtime `nodejs_compat`,
 * pas de moteur Rust natif exécutable). Sur Workers, une connexion Postgres
 * brute (`pg` en TCP direct) se bloque au-delà d'une requête simple — c'est
 * un problème documenté par Cloudflare eux-mêmes, pas une erreur de
 * configuration. Le binding Hyperdrive (`HYPERDRIVE`) est leur solution :
 * il proxifie la connexion à l'edge de façon fiable pour ce runtime.
 *
 * Sur un serveur Node classique (Railway, etc.), `DATABASE_URL` est utilisée
 * directement, sans Hyperdrive — ce n'est utile que sur Workers.
 *
 * En développement, Next.js recharge les modules à chaque édition : sans ce
 * cache global, chaque rechargement ouvrirait un nouveau pool de connexions
 * jusqu'à saturer PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Pas de DATABASE_URL en variable simple : on est sur Cloudflare Workers,
  // où la connexion passe par le binding Hyperdrive (voir wrangler.jsonc).
  const hyperdrive = getCloudflareContext().env.HYPERDRIVE as
    | { connectionString: string }
    | undefined;
  if (!hyperdrive) {
    throw new Error(
      'Aucune connexion à la base : ni DATABASE_URL, ni binding Hyperdrive « HYPERDRIVE ». Voir wrangler.jsonc.',
    );
  }
  return hyperdrive.connectionString;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: connectionString() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
