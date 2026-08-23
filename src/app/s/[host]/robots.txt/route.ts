import { NextResponse } from 'next/server';

import { resolvePublicStore } from '@/lib/boutique/site/resolve';
import { env } from '@/lib/env';

/** robots.txt du site public d'une boutique — équivalent Restaurant. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const store = await resolvePublicStore(host);

  if (!store) {
    return new NextResponse('User-agent: *\nDisallow: /', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Contrairement au site Restaurant, servi soit par sous-domaine soit par
  // domaine personnalisé (jamais de préfixe de chemin en usage réel), le
  // catalogue Boutique est toujours atteint via `boutique.magyapro.com/s/<slug>`
  // (voir le commentaire dans `src/middleware.ts`) — l'URL de base inclut donc
  // systématiquement ce préfixe.
  const base = `${env.isProduction ? 'https' : 'http'}://${new URL(request.url).host}/s/${host}`;

  const body = store.isDemo
    ? 'User-agent: *\nDisallow: /\n'
    : ['User-agent: *', 'Allow: /', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
