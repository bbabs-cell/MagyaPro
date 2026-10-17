import { NextResponse } from 'next/server';

import { route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { canReadPrivateFile, getPrivate } from '@/lib/storage/private';

type Params = { params: Promise<{ key: string[] }> };

/**
 * Sert un fichier privé — une preuve de paiement — à qui a le droit de la
 * voir : l'équipe MagyaPro, ou un membre du restaurant ou de la boutique à qui
 * elle a été envoyée (voir `storage/private.ts`).
 *
 * Toute autre demande — sans session, d'un autre commerce, clé inconnue ou
 * mal formée — reçoit la même réponse « introuvable » : rien ne dit si le
 * fichier existe.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { key: segments } = await params;
  const key = segments.join('/');
  const user = await getCurrentUser();
  if (!user || !(await canReadPrivateFile(user, key))) throw new NotFoundError('Fichier introuvable.');

  const file = await getPrivate(key);
  if (!file) throw new NotFoundError('Fichier introuvable.');

  return new NextResponse(Buffer.from(file.data), {
    headers: {
      'Content-Type': file.contentType,
      // Jamais en cache partagé (CDN, proxy) : la réponse dépend de qui demande.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});
