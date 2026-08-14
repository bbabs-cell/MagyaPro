import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routage multi-domaine.
 *
 * Une seule application sert trois familles d'URL :
 *   - le domaine racine (magyapro.app)        → landing, dashboard, administration
 *   - un sous-domaine (chez-fatou.magyapro.app) → site public du restaurant
 *   - un domaine personnalisé (mon-resto.com) → site public du restaurant
 *
 * Le middleware ne fait que réécrire : il identifie l'hôte et route la requête
 * vers `/r/<hôte>`. Il ne consulte pas la base — il s'exécute sur chaque
 * requête, y compris les fichiers statiques, et doit rester instantané. C'est
 * le segment `/r/[host]` qui résout l'hôte en restaurant, avec les contrôles
 * de statut associés.
 */

const ROOT_DOMAIN = (process.env.APP_ROOT_DOMAIN ?? 'magyapro.localhost:3000')
  .split(':')[0]!
  .toLowerCase();

/** Sous-domaines qui appartiennent à la plateforme, pas à un restaurant. */
const PLATFORM_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin']);

export const config = {
  matcher: [
    /*
     * Tout sauf les ressources internes de Next, les fichiers du dossier
     * public et les routes d'API — celles-ci sont communes à tous les hôtes et
     * déterminent elles-mêmes leur tenant.
     */
    '/((?!api/|_next/|favicon.ico|manifest.webmanifest|robots.txt|uploads/|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|css|js|txt|xml)$).*)',
  ],
};

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase();
  const { pathname } = request.nextUrl;

  // Réécriture déjà effectuée, ou accès direct en prévisualisation.
  if (pathname.startsWith('/r/')) return NextResponse.next();

  const isRootDomain =
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '';

  if (isRootDomain) return NextResponse.next();

  let identifier: string | null = null;

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = host.slice(0, -(ROOT_DOMAIN.length + 1));
    // Un sous-domaine à plusieurs niveaux n'identifie pas un restaurant.
    if (!subdomain.includes('.') && !PLATFORM_SUBDOMAINS.has(subdomain)) {
      identifier = subdomain;
    }
  } else {
    // Hôte étranger au domaine racine : domaine personnalisé potentiel.
    identifier = host;
  }

  if (!identifier) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/r/${identifier}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}
