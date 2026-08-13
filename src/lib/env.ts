/**
 * Accès centralisé et validé aux variables d'environnement.
 *
 * Aucun secret n'est exposé au client : seules les variables préfixées
 * `NEXT_PUBLIC_` traversent la frontière serveur/navigateur, et elles ne
 * contiennent que des valeurs publiques (URL, nom de domaine).
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example.`,
    );
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  isProduction,
  isTest: process.env.NODE_ENV === 'test',

  databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),

  get sessionSecret(): string {
    const secret = required('SESSION_SECRET', process.env.SESSION_SECRET);
    if (isProduction && secret.length < 32) {
      throw new Error(
        'SESSION_SECRET doit faire au moins 32 caractères en production.',
      );
    }
    return secret;
  },

  /** Domaine racine servant les sites publics, sans protocole. */
  rootDomain: process.env.APP_ROOT_DOMAIN ?? 'magya.localhost:3000',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://magya.localhost:3000',

  storageDriver: process.env.STORAGE_DRIVER ?? 'local',
  mailDriver: process.env.MAIL_DRIVER ?? 'console',
  mailFrom: process.env.MAIL_FROM ?? 'Magya <no-reply@magya.app>',
} as const;

/** Hôte racine sans le port — utile pour comparer un `Host` entrant. */
export function rootHostname(): string {
  return env.rootDomain.split(':')[0]!.toLowerCase();
}
