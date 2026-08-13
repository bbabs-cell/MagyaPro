import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique. En développement, Next.js recharge les modules à
 * chaque édition : sans ce cache global, chaque rechargement ouvrirait un
 * nouveau pool de connexions jusqu'à saturer PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
