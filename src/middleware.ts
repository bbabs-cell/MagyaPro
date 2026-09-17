import { NextResponse, type NextRequest } from 'next/server';

import { isLocale } from '@/lib/i18n/locales';
import { contentSecurityPolicy, generateNonce } from '@/lib/security/csp';
import { LOCALE_PARAM } from '@/lib/site/public-url';

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
 * En-têtes ajoutés à toute requête, quelle que soit la branche empruntée
 * ci-dessous.
 *
 * `x-pathname` : Next.js ne transmet pas le chemin demandé aux `layout`, qui
 * en ont pourtant besoin — le mur d'abonnement doit laisser passer la page de
 * paiement tout en bloquant le reste du tableau de bord.
 *
 * `x-locale` : la langue demandée par l'URL. Elle vivait uniquement dans un
 * cookie, ce qui convient à un humain qui clique sur le sélecteur mais rend
 * les traductions **invisibles aux moteurs de recherche**, qui n'envoient pas
 * de cookie. Un `?lang=en` donne à chaque langue une adresse à indexer.
 *
 * La valeur est validée contre la liste des langues connues : un paramètre
 * forgé ne peut donc rien produire d'autre qu'une des trois langues prévues.
 */
function requestHeaders(request: NextRequest, csp: Csp, publicSite = false): Headers {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);

  /**
   * Le nonce doit voyager sur la **requête**, pas seulement sur la réponse :
   * c'est ainsi que Next.js le découvre et l'appose lui-même sur ses scripts
   * d'hydratation et sur ceux de `next/script`. Posé uniquement sur la
   * réponse, le navigateur exigerait un jeton que personne n'aurait écrit sur
   * les balises — la page resterait inerte, sans erreur visible ailleurs que
   * dans la console.
   */
  headers.set('x-nonce', csp.nonce);
  headers.set('Content-Security-Policy', csp.policy);

  // Seule une vitrine parle plusieurs langues. Le tableau de bord reste en
  // français, et son `<html lang>` ne doit pas suivre la préférence que le
  // commerçant a choisie en visitant son propre site public.
  if (publicSite) headers.set('x-public-site', '1');
  else headers.delete('x-public-site');

  const requested = request.nextUrl.searchParams.get(LOCALE_PARAM);
  if (isLocale(requested)) headers.set('x-locale', requested);
  else headers.delete('x-locale');

  return headers;
}

/** Jeton et politique d'une seule réponse — voir `lib/security/csp.ts`. */
type Csp = { nonce: string; policy: string };

/**
 * Pose la politique sur la réponse.
 *
 * La CSP était déclarée dans `next.config.ts`, où elle s'appliquait à tous les
 * chemins. Elle est désormais posée ici, parce qu'un nonce doit changer à
 * chaque réponse. Conséquence assumée : les chemins que ce middleware ne
 * traite pas — routes d'API et fichiers statiques, exclus par le `matcher`
 * ci-dessus — ne reçoivent plus de CSP. Aucun d'eux ne rend de page : ils
 * servent du JSON, des images ou des fichiers, protégés par `nosniff` et par
 * une liste fermée de types. Les autres en-têtes de sécurité restent, eux,
 * dans `next.config.ts` et couvrent toujours l'ensemble.
 */
function withCsp(response: NextResponse, csp: Csp) {
  response.headers.set('Content-Security-Policy', csp.policy);
  return response;
}

function withPathname(request: NextRequest, csp: Csp, publicSite = false) {
  return withCsp(
    NextResponse.next({ request: { headers: requestHeaders(request, csp, publicSite) } }),
    csp,
  );
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase();
  const { pathname } = request.nextUrl;

  const nonce = generateNonce();
  const csp: Csp = {
    nonce,
    policy: contentSecurityPolicy(nonce, process.env.NEXT_PUBLIC_STORAGE_HOST),
  };

  // Réécriture déjà effectuée, ou accès direct en prévisualisation.
  if (pathname.startsWith('/r/') || pathname.startsWith('/boutique')) {
    return withPathname(request, csp, pathname.startsWith('/r/'));
  }

  const isRootDomain =
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '';

  if (isRootDomain) return withPathname(request, csp);

  // boutique.magyapro.com : landing et dashboard MagyaPro Boutique, servis
  // depuis `src/app/boutique/`, sous le même déploiement que Restaurant.
  if (host === `boutique.${ROOT_DOMAIN}`) {
    const url = request.nextUrl.clone();
    url.pathname = `/boutique${pathname === '/' ? '' : pathname}`;
    return withCsp(
      NextResponse.rewrite(url, { request: { headers: requestHeaders(request, csp) } }),
      csp,
    );
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

  if (!identifier) return withCsp(NextResponse.next(), csp);

  const url = request.nextUrl.clone();
  url.pathname = `/r/${identifier}${pathname === '/' ? '' : pathname}`;
  return withCsp(
    NextResponse.rewrite(url, { request: { headers: requestHeaders(request, csp, true) } }),
    csp,
  );
}
