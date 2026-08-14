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
  rootDomain: process.env.APP_ROOT_DOMAIN ?? 'magyapro.localhost:3000',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://magyapro.localhost:3000',

  storageDriver: process.env.STORAGE_DRIVER ?? 'local',
  mailDriver: process.env.MAIL_DRIVER ?? 'console',
  mailFrom: process.env.MAIL_FROM ?? 'Magyapro <no-reply@magyapro.app>',

  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  /// `true`/`465` = TLS implicite ; sinon STARTTLS sur le port indiqué.
  smtpSecure: process.env.SMTP_SECURE === 'true',

  storageHost: process.env.NEXT_PUBLIC_STORAGE_HOST,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Region: process.env.S3_REGION,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  /// URL publique de base servant les fichiers (CDN ou endpoint S3 direct).
  /// Par défaut, dérivée du bucket + endpoint pour un usage S3-compatible standard.
  get s3PublicBaseUrl(): string {
    if (env.storageHost) return `https://${env.storageHost}`;
    if (env.s3Endpoint && env.s3Bucket) {
      const endpoint = env.s3Endpoint.replace(/^https?:\/\//, '');
      return `https://${env.s3Bucket}.${endpoint}`;
    }
    return '';
  },
} as const;

/** Hôte racine sans le port — utile pour comparer un `Host` entrant. */
export function rootHostname(): string {
  return env.rootDomain.split(':')[0]!.toLowerCase();
}
