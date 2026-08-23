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
  // `max: 1` seulement sur Workers : Hyperdrive maintient déjà le vrai pool
  // de connexions côté origine, un pool local plus large ne ferait que
  // multiplier des connexions Worker → Hyperdrive pour rien. Sur un serveur
  // Node classique (Vercel, Railway...), il n'y a pas de Hyperdrive — ce pool
  // local *est* la seule connexion réelle à la base, et le limiter à 1 a
  // provoqué des transactions interactives cassées en production
  // (« Transaction not found », la connexion unique étant disputée entre
  // requêtes concurrentes).
  const adapter = new PrismaPg({
    connectionString: connectionString(),
    max: isCloudflareRuntime() ? 1 : 5,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * `true` uniquement sur Workers.
 *
 * Ne se base plus sur l'absence de `DATABASE_URL` : cette variable peut
 * exister aussi sur Workers (contournement temporaire du binding Hyperdrive,
 * ou tout autre besoin futur), auquel cas se fier à sa présence ferait
 * croire à tort qu'on tourne sur un serveur Node classique et désactiverait
 * le cache par requête ci-dessus — avec des connexions PG réutilisées d'une
 * requête à l'autre malgré elles, et des ruptures de connexion aléatoires en
 * conséquence (constaté en production). `navigator.userAgent` vaut
 * `"Cloudflare-Workers"` sur ce runtime, jamais sur Node.
 */
function isCloudflareRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
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
  // Mis en cache dans tous les environnements, pas seulement en
  // développement : la restriction précédente n'avait jamais été exercée en
  // production (l'app ne tournait que sur Workers, qui passe par le chemin
  // request-scoped ci-dessus) — sur un vrai serveur Node ou une fonction
  // serverless (Vercel...), elle recréait un client Prisma neuf, avec son
  // propre pool de connexions, à *chaque* accès à `prisma`, cassant au
  // passage toute transaction interactive en cours (P2028 « Transaction
  // not found ») et multipliant les connexions ouvertes vers la base.
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
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
