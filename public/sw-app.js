/**
 * Agent de service des tableaux de bord — Restaurant (`/dashboard/`) et
 * Boutique (`/boutique/dashboard/`).
 *
 * Il fait une seule chose : qu'un écran déjà ouvert sur cet appareil
 * s'ouvre encore quand le réseau tombe. Sans lui, la file d'attente des
 * ventes ne servait que tant que la page de caisse restait ouverte : un
 * onglet rechargé, un téléphone redémarré sans réseau, et la caisse
 * affichait l'erreur du navigateur.
 *
 * ## Ce qui est gardé, et ce qui ne l'est jamais
 *
 * - **Les pages** : réseau d'abord, copie enregistrée en secours. En ligne, on
 *   voit toujours la page fraîche ; hors ligne, sa dernière version.
 * - **Les fichiers de l'application** (`/_next/static/`) : copie d'abord. Leur
 *   nom change à chaque version, une copie n'est donc jamais périmée.
 * - **Jamais l'API**, ni aucune écriture. Une commande, une vente, un stock
 *   servis depuis une copie seraient des réponses fausses présentées comme
 *   vraies. Les ventes hors ligne passent par leur propre file
 *   (`offline-queue.ts`), qui renvoie au serveur, jamais par ici.
 *
 * ## Les écrans les plus utilisés, prêts d'avance
 *
 * Un écran jamais ouvert sur l'appareil n'a pas de copie. La page envoie donc
 * la liste des écrans les plus utilisés de son produit (« warm »), et ils sont
 * enregistrés en arrière-plan, avec les fichiers dont ils ont besoin pour
 * démarrer : la caisse s'ouvre hors ligne même si elle n'a pas été ouverte
 * depuis la dernière version.
 *
 * ## Un appareil partagé ne montre pas les données d'un autre
 *
 * Les pages enregistrées contiennent des données du commerce : clients,
 * chiffres, commandes. Elles sont rangées sous l'identité de la personne
 * connectée et du commerce ; à un changement d'identité, les copies de la
 * précédente sont effacées, et la déconnexion efface tout (« clear »).
 */

const VERSION = 'v1';
const ASSETS = `magyapro-app-assets-${VERSION}`;
const META = 'magyapro-app-meta';
const PAGES_PREFIX = 'magyapro-app-pages-';

/** Les deux tableaux de bord. Rien d'autre n'est servi par cet agent. */
const SCOPES = ['/dashboard', '/boutique/dashboard'];

/**
 * Délai au-delà duquel une page lente est servie depuis sa copie. Une
 * connexion qui ne répond plus vaut une connexion absente : attendre une
 * minute devant une caisse est pire que de voir la dernière version.
 */
const NETWORK_TIMEOUT_MS = 6000;

/** Intervalle minimal entre deux préparations des écrans les plus utilisés. */
const WARM_INTERVAL_MS = 10 * 60 * 1000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('magyapro-app-assets-') && key !== ASSETS)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// ----------------------------------------------------------------- Identité

async function readMeta(key) {
  const cache = await caches.open(META);
  const response = await cache.match(`/__meta/${key}`);
  return response ? response.text() : null;
}

async function writeMeta(key, value) {
  const cache = await caches.open(META);
  await cache.put(`/__meta/${key}`, new Response(String(value)));
}

async function pagesCache() {
  const identity = await readMeta('identity');
  return identity ? caches.open(PAGES_PREFIX + identity) : null;
}

/**
 * Change d'identité : efface les pages enregistrées pour toute autre
 * personne ou tout autre commerce.
 */
async function adoptIdentity(identity) {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(PAGES_PREFIX) && key !== PAGES_PREFIX + identity)
      .map((key) => caches.delete(key)),
  );
  await writeMeta('identity', identity);
}

async function clearAll() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(PAGES_PREFIX) || key === META)
      .map((key) => caches.delete(key)),
  );
}

// ------------------------------------------------------------ Classement

function inScope(url) {
  return SCOPES.some((scope) => url.pathname === scope || url.pathname.startsWith(`${scope}/`));
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

/**
 * Une page qui mérite d'être gardée : réussie, HTML, et **pas une
 * redirection**. Une session expirée renvoie vers la connexion ; garder cette
 * réponse remplacerait la caisse par l'écran de connexion, hors ligne.
 */
function keepable(response) {
  return (
    response &&
    response.ok &&
    !response.redirected &&
    response.type === 'basic' &&
    (response.headers.get('content-type') || '').includes('text/html')
  );
}

// ------------------------------------------------------------- Stratégies

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Clé d'une page : son chemin, sans paramètres — ceux de Next n'en font pas une autre page. */
function pageKey(url) {
  return new URL(url.pathname, url.origin).toString();
}

async function networkFirst(request) {
  const url = new URL(request.url);
  const cache = await pagesCache();
  const network = fetch(request);

  try {
    const response = await withTimeout(network, NETWORK_TIMEOUT_MS);
    if (cache && keepable(response)) cache.put(pageKey(url), response.clone());
    return response;
  } catch {
    const cached = cache ? await cache.match(pageKey(url)) : null;
    if (cached) return cached;
    // Pas de copie : on laisse au réseau sa chance jusqu'au bout plutôt que
    // d'abandonner au bout de six secondes une page qui allait arriver.
    try {
      return await network;
    } catch {
      return offlinePage(url, cache);
    }
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Données vivantes : jamais servies depuis une copie.
  if (url.pathname.startsWith('/api/')) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation entre écrans dans l'application : Next demande une « charge
  // utile RSC », pas une page. Hors ligne, cette demande échoue et Next
  // retombe de lui-même sur une navigation complète — que la règle suivante
  // sert depuis la copie. Rien à faire ici.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return;

  if (request.mode === 'navigate' && inScope(url)) {
    event.respondWith(networkFirst(request));
  }
});

// ------------------------------------------- Écrans les plus utilisés

/** Les fichiers dont une page a besoin pour démarrer, lus dans son HTML. */
function assetUrls(html) {
  const found = new Set();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) {
    found.add(match[0].replace(/\\u0026/g, '&'));
  }
  return [...found];
}

async function warm(pages) {
  const last = Number((await readMeta('warmed-at')) || 0);
  if (Date.now() - last < WARM_INTERVAL_MS) return;
  await writeMeta('warmed-at', Date.now());

  const cache = await pagesCache();
  if (!cache) return;
  const assets = await caches.open(ASSETS);

  // Dans l'ordre reçu : le plus utilisé d'abord. Si la connexion tombe en
  // cours de route, c'est lui qui aura été enregistré.
  for (const page of pages) {
    try {
      const url = new URL(page.href, self.location.origin);
      const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
      if (!keepable(response)) continue; // pas le droit, session expirée…
      const html = await response.clone().text();
      await cache.put(pageKey(url), response);
      await writeMeta(`label:${url.pathname}`, page.label);

      for (const asset of assetUrls(html)) {
        if (await assets.match(asset)) continue;
        const file = await fetch(asset).catch(() => null);
        if (file && file.ok) await assets.put(asset, file);
      }
    } catch {
      // Un écran manqué n'empêche pas les suivants.
    }
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'warm' && typeof data.identity === 'string' && Array.isArray(data.pages)) {
    event.waitUntil(adoptIdentity(data.identity).then(() => warm(data.pages)));
  }
  if (data.type === 'identity' && typeof data.identity === 'string') {
    event.waitUntil(adoptIdentity(data.identity));
  }
  if (data.type === 'clear') {
    event.waitUntil(clearAll());
  }
});

// ------------------------------------------------------- Page hors ligne

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Ce que voit quelqu'un qui ouvre, hors ligne, un écran jamais enregistré :
 * pas l'erreur du navigateur, mais ce qui reste disponible sur cet appareil.
 */
async function offlinePage(url, cache) {
  const links = [];
  if (cache) {
    for (const request of await cache.keys()) {
      const path = new URL(request.url).pathname;
      const label = (await readMeta(`label:${path}`)) || path;
      links.push(`<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`);
    }
  }
  const boutique = url.pathname.startsWith('/boutique');
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hors connexion — MagyaPro</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #ece5d8; color: #211d16;
         font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 34rem; margin: 1.5rem; padding: 1.75rem; border-radius: 1.25rem;
         background: #fbf8f2; border: 1px solid #ddd3c1;
         box-shadow: 0 1px 2px rgba(33,29,22,.06), 0 6px 16px -10px rgba(33,29,22,.18); }
  h1 { margin: 0 0 .5rem; font-size: 1.25rem; }
  p { margin: 0 0 1rem; color: #6a6153; }
  ul { margin: 0; padding: 0; list-style: none; }
  li + li { margin-top: .5rem; }
  a { display: flex; align-items: center; min-height: 44px; padding: 0 1rem; border-radius: .875rem;
      border: 1px solid #ddd3c1; color: #211d16; text-decoration: none; font-weight: 500; }
</style></head>
<body><main>
  <h1>Pas de connexion</h1>
  <p>Cette page n’a pas encore été ouverte sur cet appareil, il n’en existe donc aucune copie.${
    boutique ? ' La caisse, si elle est enregistrée, continue d’encaisser.' : ''
  }</p>
  ${links.length ? `<p>Disponibles hors connexion :</p><ul>${links.join('')}</ul>` : ''}
</main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
