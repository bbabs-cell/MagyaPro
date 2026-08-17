import { NextResponse } from 'next/server';

import { platformLogoUrl } from '@/lib/storage';

/**
 * Manifeste PWA du tableau de bord lui-même — distinct du manifeste par
 * restaurant (`r/[host]/manifest.webmanifest`), qui concerne le site public.
 * Un restaurateur peut ainsi installer son espace de gestion sur l'écran
 * d'accueil de son téléphone, sans passer par un store d'applications.
 */
export async function GET() {
  const icon = platformLogoUrl();

  return NextResponse.json(
    {
      name: 'Magyapro — Tableau de bord',
      short_name: 'Magyapro',
      description: 'Gérez votre restaurant : menu, commandes, livraisons, réservations.',
      start_url: '/dashboard',
      scope: '/dashboard',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#0b1730',
      lang: 'fr',
      categories: ['business', 'food'],
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
