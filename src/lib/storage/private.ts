import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import type { StoredFile } from '@/lib/storage/types';

/**
 * Stockage privé — les preuves de paiement.
 *
 * Captures d'écran Wave ou Orange Money envoyées par un client à un
 * restaurant, ou par un commerçant à MagyaPro : nom, numéro de téléphone,
 * montant, référence de transaction. Elles étaient rangées avec les photos de
 * plats, dans le bucket public, protégées seulement par une adresse
 * imprévisible — mais une adresse se recopie, se transfère, reste dans un
 * historique.
 *
 * Elles vont désormais dans un espace sans accès public, et ne sont servies
 * que par `/api/fichiers-prives/…`, qui vérifie qui demande (voir
 * `canReadPrivateFile`).
 *
 * - En production (pilote S3/R2) : le bucket `S3_PRIVATE_BUCKET`, mêmes
 *   identifiants que le bucket public. Tant qu'il n'est pas renseigné, rien
 *   ne change : les preuves restent publiques, comme avant — on ne casse pas
 *   l'envoi d'une preuve pour une variable manquante.
 * - En local : `.data/private-uploads`, hors de `public/`.
 */

export const PRIVATE_FILES_PREFIX = '/api/fichiers-prives/';

/** Dossiers dont le contenu ne doit jamais être public. */
export const PRIVATE_FOLDERS = new Set(['payment-proofs', 'subscription-proofs']);

const LOCAL_ROOT = join(process.cwd(), '.data', 'private-uploads');

function localPath(key: string): string {
  const resolved = join(LOCAL_ROOT, normalize(key).replace(/^(\.\.(\/|\\|$))+/, ''));
  if (!resolved.startsWith(LOCAL_ROOT + sep)) throw new Error('Clé de stockage invalide.');
  return resolved;
}

let cachedClient: S3Client | null = null;
function s3(): S3Client {
  cachedClient ??= new S3Client({
    region: env.s3Region || 'auto',
    endpoint: env.s3Endpoint || undefined,
    forcePathStyle: Boolean(env.s3Endpoint),
    credentials: { accessKeyId: env.s3AccessKeyId ?? '', secretAccessKey: env.s3SecretAccessKey ?? '' },
  });
  return cachedClient;
}

export function privateStorageAvailable(): boolean {
  if (env.storageDriver === 'local') return true;
  return env.storageDriver === 's3' && Boolean(env.s3PrivateBucket);
}

export async function putPrivate(key: string, data: Uint8Array, contentType: string): Promise<StoredFile> {
  if (env.storageDriver === 'local') {
    const target = localPath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    await writeFile(`${target}.type`, contentType);
  } else {
    await s3().send(
      new PutObjectCommand({
        Bucket: env.s3PrivateBucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'private, no-store',
      }),
    );
  }
  return { key, url: `${PRIVATE_FILES_PREFIX}${key}`, contentType, size: data.byteLength };
}

export async function getPrivate(key: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    if (env.storageDriver === 'local') {
      const target = localPath(key);
      const [data, contentType] = await Promise.all([readFile(target), readFile(`${target}.type`, 'utf8')]);
      return { data, contentType };
    }
    const object = await s3().send(new GetObjectCommand({ Bucket: env.s3PrivateBucket, Key: key }));
    if (!object.Body) return null;
    return {
      data: await object.Body.transformToByteArray(),
      contentType: object.ContentType ?? 'application/octet-stream',
    };
  } catch (error) {
    // Fichier absent (disque ou bucket) ou clé qui sortirait du répertoire :
    // dans tous les cas, « introuvable » — jamais le détail de l'erreur.
    const { code, name, message } = error as { code?: string; name?: string; message?: string };
    if (code === 'ENOENT' || name === 'NoSuchKey' || message === 'Clé de stockage invalide.') return null;
    throw error;
  }
}

/**
 * Qui peut lire une preuve : l'équipe MagyaPro, et les membres du restaurant
 * ou de la boutique à qui elle a été envoyée. La clé commence par
 * l'identifiant de ce commerce (`<commerce>/<dossier>/<aléa>.<ext>`, posé par
 * `uploadImage`), et c'est lui qui est vérifié — jamais une information venue
 * de la requête.
 */
export function privateKeyOwner(key: string): string | null {
  const [owner, folder, file, ...rest] = key.split('/');
  if (!owner || !folder || !file || rest.length > 0) return null;
  if (!PRIVATE_FOLDERS.has(folder)) return null;
  if (!/^[a-z0-9-]+\.(jpg|png|webp|avif)$/i.test(file)) return null;
  return owner;
}

/** Vrai si ce compte peut lire ce fichier privé — voir `privateKeyOwner`. */
export async function canReadPrivateFile(
  user: { id: string; platformRole: string },
  key: string,
): Promise<boolean> {
  const owner = privateKeyOwner(key);
  if (!owner) return false;
  if (user.platformRole === 'SUPER_ADMIN') return true;
  const [restaurantMember, storeMember] = await Promise.all([
    prisma.restaurantUser.count({ where: { restaurantId: owner, userId: user.id } }),
    prisma.storeUser.count({ where: { storeId: owner, userId: user.id } }),
  ]);
  return restaurantMember + storeMember > 0;
}
