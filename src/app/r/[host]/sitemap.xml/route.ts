import { NextResponse } from 'next/server';

import { loadPublicMenu, resolvePublicRestaurant } from '@/lib/site/resolve';
import { env } from '@/lib/env';

/**
 * Sitemap propre à chaque restaurant.
 *
 * Il liste l'accueil, le menu, les informations et chaque fiche produit. Le
 * panier et les pages de commande en sont exclus : ce sont des pages
 * transactionnelles, sans intérêt pour un moteur, et déjà marquées `noindex`.
 *
 * Les URL sont construites sur le domaine public du restaurant lorsqu'il en a
 * un ; à défaut sur son sous-domaine.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const restaurant = await resolvePublicRestaurant(host);

  if (!restaurant) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Un restaurant de démonstration ne doit pas être soumis aux moteurs.
  if (restaurant.isDemo) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }

  const categories = await loadPublicMenu(restaurant.id);

  // L'hôte réel de la requête est utilisé s'il diffère du domaine racine :
  // le sitemap doit refléter l'adresse par laquelle le site est servi.
  const requestHost = new URL(request.url).host;
  const protocol = env.isProduction ? 'https' : 'http';
  const origin = requestHost.includes('/r/')
    ? env.appUrl
    : `${protocol}://${requestHost}`;

  const isPreview = new URL(request.url).pathname.startsWith('/r/');
  const base = isPreview ? `${env.appUrl}/r/${host}` : origin;

  const entries: Array<{ path: string; priority: string; changefreq: string }> = [
    { path: '', priority: '1.0', changefreq: 'weekly' },
    { path: '/menu', priority: '0.9', changefreq: 'daily' },
    { path: '/infos', priority: '0.6', changefreq: 'monthly' },
    ...categories.flatMap((category) =>
      category.products.map((product) => ({
        path: `/plat/${product.slug}`,
        priority: '0.7',
        changefreq: 'weekly',
      })),
    ),
  ];

  const lastmod = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(base + entry.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
