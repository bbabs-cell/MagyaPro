import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    // Les tests partagent une base PostgreSQL réelle : les faire tourner en
    // parallèle produirait des interférences entre suites (compteurs,
    // contraintes d'unicité). L'exécution séquentielle est le prix d'un test
    // qui vérifie le vrai comportement de la base plutôt qu'un simulacre.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
