import { NextResponse } from 'next/server';

import { resolvePublicRestaurant } from '@/lib/site/resolve';
import { env } from '@/lib/env';

/**
 * robots.txt du site public d'un restaurant.
 *
 * Les pages transactionnelles (panier, confirmation de commande) sont
 * interdites d'exploration : elles n'ont aucune valeur en recherche et
 * contiennent des informations propres à un client.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);

  if (!restaurant) {
    return new NextResponse('User-agent: *\nDisallow: /', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const isPreview = new URL(request.url).pathname.startsWith('/r/');
  const base = isPreview
    ? `${env.appUrl}/r/${host}`
    : `${env.isProduction ? 'https' : 'http'}://${new URL(request.url).host}`;

  // Les restaurants de démonstration sont entièrement exclus de l'indexation.
  const body = restaurant.isDemo
    ? 'User-agent: *\nDisallow: /\n'
    : [
        'User-agent: *',
        'Allow: /',
        'Disallow: /panier',
        'Disallow: /commande/',
        '',
        `Sitemap: ${base}/sitemap.xml`,
        '',
      ].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
