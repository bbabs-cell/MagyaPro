import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '@/lib/env';
import type { StorageDriver, StoredFile } from '@/lib/storage/types';

/**
 * Pilote de stockage objet, compatible S3 (AWS S3, Cloudflare R2, DigitalOcean
 * Spaces, Backblaze B2…) via le SDK AWS standard.
 *
 * Nécessaire dès que l'application tourne sur plusieurs instances ou une
 * plateforme serverless : le disque local n'y est ni partagé ni persistant.
 */

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;
  if (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
    throw new Error(
      'Pilote S3 demandé mais S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY manquants. Voir .env.example.',
    );
  }
  cachedClient = new S3Client({
    region: env.s3Region || 'auto',
    endpoint: env.s3Endpoint || undefined,
    // Requis par la plupart des fournisseurs S3-compatibles hors AWS (R2,
    // Spaces…) : sans cela, le SDK génère des URLs de style AWS invalides.
    forcePathStyle: Boolean(env.s3Endpoint),
    credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey },
  });
  return cachedClient;
}

function publicUrl(key: string): string {
  const base = env.s3PublicBaseUrl;
  if (!base) {
    throw new Error(
      'Aucune URL publique configurée pour le stockage S3 : renseignez NEXT_PUBLIC_STORAGE_HOST (CDN) ou S3_ENDPOINT + S3_BUCKET.',
    );
  }
  return `${base}/${key}`;
}

export const s3StorageDriver: StorageDriver = {
  name: 's3',

  async put(key, data, contentType): Promise<StoredFile> {
    if (!env.s3Bucket) throw new Error('S3_BUCKET manquant.');
    await client().send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        // Les images téléversées servent le site public : elles doivent être
        // lisibles sans URL signée, comme sur le pilote local.
        ACL: 'public-read',
      }),
    );

    return { key, url: this.url(key), contentType, size: data.byteLength };
  },

  async delete(key): Promise<void> {
    if (!env.s3Bucket) throw new Error('S3_BUCKET manquant.');
    await client().send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  },

  url(key): string {
    return publicUrl(key);
  },
};
