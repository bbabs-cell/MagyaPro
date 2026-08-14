import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma, via l'adaptateur `pg` plutôt que le moteur binaire par
 * défaut de Prisma.
 *
 * Nécessaire pour tourner sur Cloudflare Workers (runtime `nodejs_compat`,
 * pas de moteur Rust natif exécutable).
 *
 * Sur Workers, réutiliser un même pool de connexions Postgres **entre deux
 * requêtes HTTP distinctes** est intermittent : une connexion laissée par
 * une requête précédente peut se retrouver dans un état bloqué pour la
 * suivante — constaté empiriquement (succès et blocages alternés sur un même
 * point d'accès, aucune erreur JS observable). La parade adoptée ici : une
 * connexion neuve par requête sur Workers, mise en cache uniquement pour la
 * durée de cette requête (`ExecutionContext`, fourni par
 * `getCloudflareContext()`, est unique par requête). Sur Node (Railway...),
 * un singleton global reste utilisé : c'est le comportement fiable et
 * habituel d'un serveur persistant.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

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

/** `true` uniquement sur Workers : `DATABASE_URL` n'y existe jamais en variable simple. */
function isCloudflareRuntime(): boolean {
  return !process.env.DATABASE_URL;
}

const requestScopedClients = new WeakMap<object, PrismaClient>();

function getRequestScopedClient(): PrismaClient {
  const { ctx } = getCloudflareContext();
  const cached = requestScopedClients.get(ctx as object);
  if (cached) return cached;

  const client = createPrismaClient();
  requestScopedClients.set(ctx as object, client);
  return client;
}

function getNodeSingletonClient(): PrismaClient {
  const client = globalForPrisma.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Proxy plutôt qu'une instance figée à l'import : sur Workers, chaque accès
 * doit pouvoir résoudre le client de la requête *en cours*, qui change à
 * chaque appel entrant — un export const classique capturerait celui de la
 * toute première requête ayant chargé ce module.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = isCloudflareRuntime() ? getRequestScopedClient() : getNodeSingletonClient();
    return Reflect.get(client as object, prop, receiver);
  },
});
