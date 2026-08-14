import { config } from 'dotenv';

/**
 * Préparation de l'environnement de test.
 *
 * Les tests s'exécutent contre une **vraie base PostgreSQL**, distincte de
 * celle de développement. Simuler Prisma laisserait passer précisément les
 * défauts que ces tests cherchent : contraintes d'unicité, cascades,
 * transactions, et surtout l'isolation entre tenants, qui repose sur des
 * clauses SQL.
 *
 * `TEST_DATABASE_URL` est obligatoire : sans elle, un test lancé par
 * inadvertance viderait la base de développement.
 */
config({ path: '.env', quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL est absent. Renseignez-le dans .env avant de lancer les tests (voir .env.example).',
  );
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL doit désigner une base différente de DATABASE_URL : les tests effacent leurs données.',
  );
}

// Prisma lit DATABASE_URL au moment d'instancier son client : la substitution
// doit donc avoir lieu avant tout import de `@/lib/db`.
process.env.DATABASE_URL = testDatabaseUrl;
// `NODE_ENV` est typé lecture seule dans les définitions récentes de Node ;
// `Object.defineProperty` contourne la vérification sans recourir à `any`.
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  enumerable: true,
  configurable: true,
});
process.env.SESSION_SECRET ??= 'test-secret-suffisamment-long-pour-les-tests-1234';
process.env.MAIL_DRIVER = 'console';
process.env.APP_ROOT_DOMAIN ??= 'magyapro.test';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://magyapro.test';
