import { NextResponse } from 'next/server';

import { resolvePublicRestaurant } from '@/lib/site/resolve';

/**
 * Manifeste PWA propre à chaque restaurant.
 *
 * Il est généré à la volée à partir des données du tenant : nom, couleurs et
 * icône de l'établissement. Un client qui installe le site obtient donc
 * l'application de *son* restaurant, pas celle de Magyapro.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);

  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const base = `/r/${host}`;
  const icon = restaurant.faviconUrl ?? restaurant.logoUrl;

  return NextResponse.json(
    {
      name: restaurant.name,
      short_name: restaurant.name.slice(0, 12),
      description:
        restaurant.seoDescription ??
        restaurant.description ??
        `Menu et commande en ligne — ${restaurant.name}`,
      start_url: `${base}/menu`,
      scope: base,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: restaurant.primaryColor,
      lang: 'fr',
      categories: ['food', 'shopping'],
      // Sans icône téléversée, le champ est omis : un manifeste déclarant une
      // icône absente échoue à l'installation.
      ...(icon
        ? {
            icons: [
              { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
            ],
          }
        : {}),
      shortcuts: [
        { name: 'Voir le menu', url: `${base}/menu` },
        { name: 'Mon panier', url: `${base}/panier` },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}
