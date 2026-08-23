import { NextResponse } from 'next/server';

import { loadPublicProducts, resolvePublicStore } from '@/lib/boutique/site/resolve';
import { sitePathBase } from '@/lib/boutique/site/base-path';
import { env } from '@/lib/env';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Sitemap du site public d'une boutique — accueil, catalogue et chaque fiche produit. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const store = await resolvePublicStore(host);

  if (!store) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (store.isDemo) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }

  const products = await loadPublicProducts(store.id);

  const requestHost = new URL(request.url).host;
  const protocol = env.isProduction ? 'https' : 'http';
  const base = `${protocol}://${requestHost}${sitePathBase(host)}`;

  const entries: Array<{ path: string; priority: string; changefreq: string }> = [
    { path: '', priority: '1.0', changefreq: 'weekly' },
    { path: '/produits', priority: '0.9', changefreq: 'daily' },
    ...products.map((product) => ({
      path: `/produits/${product.id}`,
      priority: '0.7',
      changefreq: 'weekly',
    })),
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
