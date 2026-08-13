/**
 * Service worker des sites publics.
 *
 * Stratégie assumée :
 *   - navigations et pages : réseau d'abord, cache en secours. Un menu ou un
 *     prix périmé servi depuis le cache serait pire qu'un chargement lent ;
 *   - ressources statiques (JS, CSS, images) : cache d'abord, car elles portent
 *     une empreinte dans leur nom et ne changent jamais sous un même URL ;
 *   - requêtes d'API et commandes : jamais mises en cache.
 *
 * Hors ligne, une page déjà visitée reste consultable ; à défaut, un message
 * explicite s'affiche plutôt que l'erreur du navigateur.
 */

const VERSION = 'magya-v1';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

self.addEventListener('install', () => {
  // Le nouveau service worker prend la main sans attendre la fermeture des
  // onglets : un correctif doit s'appliquer immédiatement.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Les appels d'API portent des données vivantes : commandes, disponibilités,
  // totaux. Les mettre en cache produirait des réponses fausses.
  if (url.pathname.startsWith('/api/')) return;

  const isAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/uploads/') ||
    /\.(?:css|js|woff2?|png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname);

  if (isAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return new Response('', { status: 504, statusText: 'Ressource indisponible' });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(
      `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hors ligne</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; display: grid;
             place-items: center; min-height: 100vh; padding: 24px;
             text-align: center; color: #12151a; }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { color: #5c6672; margin: 0 0 20px; max-width: 30rem; }
      button { font: inherit; padding: 12px 24px; border-radius: 12px;
               border: 0; background: #12151a; color: #fff; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Vous êtes hors ligne</h1>
      <p>Cette page n'a pas encore été consultée sur cet appareil. Reconnectez-vous à internet pour continuer.</p>
      <button onclick="location.reload()">Réessayer</button>
    </main>
  </body>
</html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
