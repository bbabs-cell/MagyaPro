import { NextResponse } from 'next/server';

import { resolvePublicStore } from '@/lib/boutique/site/resolve';
import { sitePathBase } from '@/lib/boutique/site/base-path';
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

  const base = `${env.isProduction ? 'https' : 'http'}://${new URL(request.url).host}${sitePathBase(host)}`;

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
