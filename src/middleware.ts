import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';

/**
 * Routage multi-domaine et multi-produit.
 *
 * Une seule application sert plusieurs familles d'URL :
 *   - le domaine racine (magyapro.com)              → landing, dashboard, administration MagyaPro Restaurant
 *   - un sous-domaine (chez-fatou.magyapro.com)      → site public du restaurant
 *   - un domaine personnalisé (mon-resto.com)        → site public du restaurant
 *   - boutique.magyapro.com                          → landing, dashboard MagyaPro Boutique
 *   - un chemin sous ce domaine (boutique.magyapro.com/s/<slug>) → site public d'une boutique
 *
 * Restaurant reste l'espace historique, servi directement sous le domaine
 * racine, pour ne rien changer à ses URL existantes. Chaque nouveau produit
 * (Boutique, puis d'éventuels suivants) reçoit son propre préfixe de
 * sous-domaine, réservé dans `PLATFORM_SUBDOMAINS` pour qu'un restaurant ne
 * puisse jamais choisir ce mot comme identifiant.
 *
 * Le middleware s'exécute sur chaque requête, y compris les fichiers
 * statiques, sur le runtime Edge : un appel Prisma/Postgres direct y est
 * impossible (le pilote utilisé a besoin de vrais sockets TCP). Pour un
 * sous-domaine ou un chemin `/s/<slug>` de la plateforme, aucune base n'est
 * nécessaire ici — ce sont les segments `/r/[host]` et `/s/[host]` qui
 * résolvent l'identifiant en tenant, avec les contrôles de statut associés.
 *
 * Pour un domaine personnalisé (hôte étranger au domaine racine), il faut en
 * revanche savoir *avant* la réécriture s'il appartient à un restaurant ou à
 * une boutique — deux arborescences de routes différentes. Le middleware
 * délègue cette unique décision à `/api/internal/resoudre-domaine`, une
 * route Node.js classique (donc avec accès Prisma) appelée via `fetch` —
 * compatible Edge, contrairement à une connexion base de données directe.
 * En cas d'échec de cet appel (réseau, route indisponible), on revient au
 * comportement précédent (résolution côté Restaurant) plutôt que de casser
 * les domaines personnalisés de restaurant déjà en production.
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

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase();
  const { pathname } = request.nextUrl;

  // Réécriture déjà effectuée, ou accès direct en prévisualisation.
  if (pathname.startsWith('/r/') || pathname.startsWith('/s/') || pathname.startsWith('/boutique')) {
    return NextResponse.next();
  }

  const isRootDomain =
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '';

  if (isRootDomain) return NextResponse.next();

  // boutique.magyapro.com : landing et dashboard MagyaPro Boutique, servis
  // depuis `src/app/boutique/`, sous le même déploiement que Restaurant.
  if (host === `boutique.${ROOT_DOMAIN}`) {
    // Le site public d'une boutique (`/s/<slug>`) reste ici plutôt que sur un
    // sous-domaine dédié (`<slug>.boutique.magyapro.com`) : ce joker
    // demanderait de déléguer les serveurs de noms à Vercel, ce que le
    // registrar actuel (Cloudflare Registrar) n'autorise pas sans transfert
    // complet du domaine. Chemin sous ce domaine à la place — aucun DNS
    // supplémentaire requis.
    if (pathname.startsWith('/s/')) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = `/boutique${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  let identifier: string | null = null;
  let isBoutiqueTenant = false;

  if (host.endsWith(`.boutique.${ROOT_DOMAIN}`)) {
    // <slug>.boutique.magyapro.com : site public d'une boutique.
    const subdomain = host.slice(0, -(`.boutique.${ROOT_DOMAIN}`.length));
    if (!subdomain.includes('.')) {
      identifier = subdomain;
      isBoutiqueTenant = true;
    }
  } else if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = host.slice(0, -(ROOT_DOMAIN.length + 1));
    // Un sous-domaine à plusieurs niveaux n'identifie pas un restaurant.
    if (!subdomain.includes('.') && !PLATFORM_SUBDOMAINS.has(subdomain)) {
      identifier = subdomain;
    }
  } else {
    // Hôte étranger au domaine racine : domaine personnalisé, restaurant ou
    // boutique — la décision se fait via la route de résolution (voir le
    // commentaire en tête de fichier).
    identifier = host;
    isBoutiqueTenant = await resolvesToStore(host);
  }

  if (!identifier) return NextResponse.next();

  const url = request.nextUrl.clone();
  const prefix = isBoutiqueTenant ? '/s/' : '/r/';
  url.pathname = `${prefix}${identifier}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * `true` si l'hôte étranger appartient à une boutique vérifiée, `false`
 * sinon (y compris à l'échec).
 *
 * L'appel vise notre propre domaine (`env.appUrl`), pas l'hôte entrant : ce
 * dernier n'est qu'un CNAME externe vers cette même plateforme, y repasser
 * ajouterait une résolution DNS et une poignée de main TLS inutiles.
 */
async function resolvesToStore(host: string): Promise<boolean> {
  try {
    const resolveUrl = new URL('/api/internal/resoudre-domaine', env.appUrl);
    resolveUrl.search = `host=${encodeURIComponent(host)}`;
    const response = await fetch(resolveUrl, { headers: { accept: 'application/json' } });
    if (!response.ok) return false;
    const { product } = (await response.json()) as { product: 'restaurant' | 'store' | null };
    return product === 'store';
  } catch {
    return false;
  }
}
