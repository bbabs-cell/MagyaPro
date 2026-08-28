import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routage multi-domaine et multi-produit.
 *
 * Une seule application sert plusieurs familles d'URL :
 *   - le domaine racine (magyapro.com)              → landing, dashboard, administration MagyaPro Restaurant
 *   - un sous-domaine (chez-fatou.magyapro.com)      → site public du restaurant
 *   - un domaine personnalisé (mon-resto.com)        → site public du restaurant
 *   - boutique.magyapro.com                          → landing, dashboard MagyaPro Boutique
 *
 * MagyaPro Boutique n'a pas de site public : c'est un outil interne (caisse,
 * stock, achats, clients). Seul Restaurant expose des sites de tenants, d'où
 * l'asymétrie de ce fichier.
 *
 * Restaurant reste l'espace historique, servi directement sous le domaine
 * racine, pour ne rien changer à ses URL existantes. Chaque nouveau produit
 * (Boutique, puis d'éventuels suivants) reçoit son propre préfixe de
 * sous-domaine, réservé dans `PLATFORM_SUBDOMAINS` pour qu'un restaurant ne
 * puisse jamais choisir ce mot comme identifiant.
 *
 * Le middleware s'exécute sur chaque requête, y compris les fichiers
 * statiques, sur le runtime Edge : un appel Prisma/Postgres direct y est
 * impossible (le pilote utilisé a besoin de vrais sockets TCP). Aucune base
 * n'est nécessaire ici — c'est le segment `/r/[host]` qui résout
 * l'identifiant en restaurant, avec les contrôles de statut associés.
 */

const ROOT_DOMAIN = (process.env.APP_ROOT_DOMAIN ?? 'magyapro.localhost:3000')
  .split(':')[0]!
  .toLowerCase();

/** Sous-domaine racine d'un produit — jamais un identifiant de restaurant/boutique. */
const PRODUCT_SUBDOMAINS = new Set(['boutique']);

/** Sous-domaines qui appartiennent à la plateforme, pas à un tenant. */
const PLATFORM_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', ...PRODUCT_SUBDOMAINS]);

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

/**
 * Expose le chemin demandé aux composants serveur. Next.js ne le transmet pas
 * aux `layout`, qui en ont pourtant besoin : le mur d'abonnement doit laisser
 * passer la page de paiement tout en bloquant le reste du tableau de bord.
 */
function withPathname(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase();
  const { pathname } = request.nextUrl;

  // Réécriture déjà effectuée, ou accès direct en prévisualisation.
  if (pathname.startsWith('/r/') || pathname.startsWith('/boutique')) {
    return withPathname(request);
  }

  const isRootDomain =
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '';

  if (isRootDomain) return withPathname(request);

  // boutique.magyapro.com : landing et dashboard MagyaPro Boutique, servis
  // depuis `src/app/boutique/`, sous le même déploiement que Restaurant.
  if (host === `boutique.${ROOT_DOMAIN}`) {
    const url = request.nextUrl.clone();
    url.pathname = `/boutique${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  let identifier: string | null = null;

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = host.slice(0, -(ROOT_DOMAIN.length + 1));
    // Un sous-domaine à plusieurs niveaux n'identifie pas un restaurant.
    if (!subdomain.includes('.') && !PLATFORM_SUBDOMAINS.has(subdomain)) {
      identifier = subdomain;
    }
  } else {
    // Hôte étranger au domaine racine : domaine personnalisé d'un restaurant.
    identifier = host;
  }

  if (!identifier) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/r/${identifier}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}
