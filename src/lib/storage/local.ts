import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

import { env } from '@/lib/env';
import type { StorageDriver, StoredFile } from '@/lib/storage/types';

/**
 * Pilote de stockage sur disque local (`public/uploads`).
 *
 * Adapté au développement et à un déploiement mono-serveur avec volume
 * persistant. Sur plusieurs instances, les fichiers écrits par l'une ne
 * seraient pas visibles des autres : basculer alors sur un pilote objet.
 */
const UPLOAD_ROOT = join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads';

/**
 * Empêche une clé de sortir du répertoire d'upload.
 * Sans ce contrôle, une clé contenant `../` permettrait d'écrire n'importe où
 * sur le disque du serveur.
 */
function safePath(key: string): string {
  const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = join(UPLOAD_ROOT, normalized);
  // Comparaison bornée au séparateur de chemin, pas un simple préfixe de
  // texte : sans cela, un répertoire frère comme `uploads-evil` passerait le
  // contrôle puisqu'il « commence par » `.../uploads` en tant que chaîne.
  if (resolved !== UPLOAD_ROOT && !resolved.startsWith(UPLOAD_ROOT + sep)) {
    throw new Error('Clé de stockage invalide.');
  }
  return resolved;
}

/**
 * Lit un fichier stocké localement, ou `null` s'il n'existe pas.
 *
 * Les fichiers vivent sous `public/uploads`, mais **Next.js ne sert de
 * `public/` que ce qui s'y trouvait au démarrage du serveur** : un fichier
 * téléversé après coup répondait 404 jusqu'au redémarrage suivant. Toutes les
 * photos envoyées par les commerçants étaient donc invisibles sur leur site,
 * alors que l'envoi lui-même avait réussi.
 *
 * Elles sont désormais servies par une route dédiée, qui passe par ici. Le
 * contrôle de chemin est le même qu'à l'écriture : une clé ne peut pas sortir
 * du répertoire d'upload.
 */
export async function readLocalUpload(key: string): Promise<Buffer | null> {
  let target: string;
  try {
    target = safePath(key);
  } catch {
    return null;
  }

  try {
    return await readFile(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') return null;
    throw error;
  }
}

export const localStorageDriver: StorageDriver = {
  name: 'local',

  async put(key, data, contentType): Promise<StoredFile> {
    const target = safePath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);

    return {
      key,
      url: this.url(key),
      contentType,
      size: data.byteLength,
    };
  },

  async delete(key): Promise<void> {
    try {
      await unlink(safePath(key));
    } catch (error) {
      // Un fichier déjà absent est le résultat recherché : on n'échoue pas.
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
  },

  url(key): string {
    return `${env.appUrl}${PUBLIC_PREFIX}/${key}`;
  },
};
