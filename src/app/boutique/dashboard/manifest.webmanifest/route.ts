import { NextResponse } from 'next/server';

import { platformLogoUrl } from '@/lib/storage';

/**
 * Manifeste PWA du tableau de bord Boutique — même principe que celui de
 * Restaurant (`dashboard/manifest.webmanifest`), fichier séparé puisque
 * chaque produit s'installe comme sa propre application, avec son propre
 * point d'entrée (`start_url`/`scope`).
 */
export async function GET() {
  const icon = platformLogoUrl();

  return NextResponse.json(
    {
      name: 'MagyaPro Boutique — Tableau de bord',
      short_name: 'MagyaPro Boutique',
      description: 'Gérez votre boutique : caisse, stock, ventes, clients.',
      start_url: '/boutique/dashboard',
      scope: '/boutique/dashboard',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#12151a',
      lang: 'fr',
      categories: ['business', 'shopping'],
      ...(icon
        ? {
            icons: [
              { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
            ],
          }
        : {}),
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}
