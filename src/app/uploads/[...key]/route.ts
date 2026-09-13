import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { readLocalUpload } from '@/lib/storage/local';

/**
 * Service des images téléversées, pour le pilote de stockage local.
 *
 * Le défaut corrigé : les fichiers sont écrits sous `public/uploads`, mais
 * **Next.js ne sert de `public/` que ce qui s'y trouvait au démarrage du
 * serveur**. Une photo envoyée par un commerçant répondait donc 404 jusqu'au
 * redémarrage suivant, alors que l'envoi avait réussi et que l'URL était
 * enregistrée en base. Le pilote local étant celui par défaut, tout
 * déploiement qui n'a pas configuré de stockage objet perdait l'affichage de
 * toutes ses images.
 *
 * Trois précautions, parce qu'une route qui lit des fichiers depuis une URL
 * est exactement le genre d'endroit où l'on se fait sortir du répertoire :
 *
 * 1. la clé repasse par le même contrôle de chemin qu'à l'écriture, dans
 *    `readLocalUpload` — aucune clé ne peut désigner un fichier hors du
 *    répertoire d'upload ;
 * 2. le type de contenu est choisi dans une liste fermée, d'après l'extension
 *    — laquelle est décidée par le serveur au téléversement à partir de la
 *    signature binaire réelle du fichier, jamais d'après le nom fourni ;
 * 3. toute extension inconnue est refusée plutôt que servie sans type.
 *
 * S'y ajoutent les en-têtes globaux, dont `X-Content-Type-Options: nosniff`,
 * qui empêche le navigateur de réinterpréter le contenu.
 */

/** Seuls ces types sont produits par le téléversement — voir `storage/index.ts`. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  // Un déploiement sur stockage objet sert ses fichiers depuis le CDN : cette
  // route n'a alors aucune raison de répondre.
  if (env.storageDriver !== 'local') {
    return new NextResponse('Not found', { status: 404 });
  }

  const { key } = await params;
  const path = key.join('/');

  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return new NextResponse('Not found', { status: 404 });
  }

  const data = await readLocalUpload(path);
  if (!data) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      // Les clés portent un identifiant aléatoire : un fichier ne change
      // jamais de contenu, il est remplacé par un autre. Il peut donc être
      // mis en cache longtemps.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Affiché, jamais proposé au téléchargement sous un nom choisi ailleurs.
      'Content-Disposition': 'inline',
    },
  });
}
