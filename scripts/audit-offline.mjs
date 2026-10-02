/**
 * Sonde du hors-connexion, dans un vrai navigateur, réseau réellement coupé.
 *
 * Ce qu'elle prouve, et ce que la relecture du code ne prouve pas :
 *
 * **Boutique**
 * 1. Une vente dont **la réponse se perd** — le serveur l'a enregistrée, la
 *    caisse croit à une panne et la met en attente — n'est créée qu'**une**
 *    fois quand la file se vide au retour du réseau.
 * 2. Les écrans les plus utilisés sont préparés d'avance sur l'appareil.
 * 3. **Démarrage à froid hors ligne** : la caisse rechargée sans réseau
 *    s'ouvre, encaisse, et la vente part au retour du réseau — une seule fois.
 * 4. Un écran jamais enregistré affiche une page qui dit ce qui reste
 *    disponible, pas l'erreur du navigateur.
 * 5. La déconnexion efface les pages enregistrées.
 *
 * **Restaurant**
 * 6. Commandes, cuisine et vue d'ensemble s'ouvrent hors ligne, avec le
 *    bandeau qui dit qu'elles datent de la dernière connexion.
 *
 * Contrôle positif : chaque étape hors ligne vérifie d'abord que le réseau
 * est **vraiment** coupé (une requête vers l'API doit échouer). Sans cela,
 * une page « servie hors ligne » pourrait simplement venir du réseau.
 *
 * Emploi : serveur lancé (`npm run start`), base de démonstration en place.
 *   node scripts/audit-offline.mjs
 *
 * Attention : la sonde enregistre de vraies ventes dans la boutique de
 * démonstration « Teranga ». Base locale uniquement.
 */
import net from 'node:net';
import pw from 'playwright-core';

const { chromium } = pw;
const TARGET = new URL(process.env.BASE_URL ?? 'http://localhost:3000');

/**
 * La coupure, la vraie. `context.setOffline()` de Playwright ne suffit pas :
 * mesuré, un agent de service arrêté puis relancé par le navigateur échappe
 * à la coupure simulée, et un écran jamais ouvert « s'ouvrait hors ligne »
 * avec un statut 200 venu du réseau. Le navigateur parle donc au serveur à
 * travers ce relais, que la sonde coupe elle-même : plus un octet ne passe,
 * quel que soit l'émetteur. `setOffline` reste, pour que la page reçoive
 * l'événement `offline` comme sur un vrai téléphone.
 */
let networkUp = true;
const sockets = new Set();
const relay = net.createServer((client) => {
  if (!networkUp) return client.destroy();
  const server = net.connect(Number(TARGET.port || 80), TARGET.hostname);
  for (const socket of [client, server]) {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  }
  client.pipe(server).pipe(client);
});
await new Promise((resolve) => relay.listen(0, '127.0.0.1', resolve));
const BASE = `http://localhost:${relay.address().port}`;

async function setNetwork(context, up) {
  networkUp = up;
  if (!up) for (const socket of sockets) socket.destroy();
  await context.setOffline(!up);
}
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo!2345';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
const report = [];
const check = (ok, message) => {
  report.push(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

async function signIn(page, loginPath, email) {
  await page.goto(`${BASE}${loginPath}`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => new URL(url).pathname !== loginPath, { timeout: 20_000 });
}

/** Les pages enregistrées par l'agent de service, lues dans le cache. */
const cachedPages = (page) =>
  page.evaluate(async () => {
    const out = [];
    for (const key of await caches.keys()) {
      if (!key.startsWith('magyapro-app-pages-')) continue;
      const cache = await caches.open(key);
      for (const request of await cache.keys()) out.push(new URL(request.url).pathname);
    }
    return out.sort();
  });

async function waitForPages(page, expected, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let pages = [];
  while (Date.now() < deadline) {
    pages = await cachedPages(page);
    if (expected.every((path) => pages.includes(path))) return pages;
    await page.waitForTimeout(500);
  }
  return pages;
}

/** Contrôle positif : le réseau est-il vraiment coupé ? */
const networkIsDown = (page) =>
  page.evaluate(() => fetch('/api/boutique/sales').then(() => false, () => true));

/**
 * Ventes créées depuis le début de la sonde. L'API n'en rend que les cent
 * dernières : compter la liste entière plafonnerait à cent sans rien dire.
 */
const STARTED_AT = Date.now() - 1000;
const salesCount = (page) =>
  page.evaluate(async (since) => {
    const response = await fetch('/api/boutique/sales');
    const body = await response.json();
    return body.data.sales.filter((sale) => new Date(sale.createdAt).getTime() >= since).length;
  }, STARTED_AT);

const queueLength = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('magyapro:offline-sales:'))
      .reduce((sum, key) => sum + JSON.parse(localStorage.getItem(key) || '[]').length, 0),
  );

/** Une vente réelle à la caisse : un produit, le montant exact, « Encaisser ». */
async function sellOne(page) {
  await page.locator('button:not([disabled]):has-text("F CFA")').filter({ hasNotText: 'Encaisser' }).first().click();
  const checkout = page.locator('button:has-text("Encaisser")').first();
  const label = await checkout.textContent();
  const total = (label ?? '').replace(/\D/g, '');
  await page.locator('input[placeholder="0"]').first().fill(total);
  await checkout.click();
  await page.waitForTimeout(1500);
}

// =================================================================== Boutique
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, '/boutique/connexion', 'demo-boutique@demo.magyapro.app');
  await page.goto(`${BASE}/boutique/dashboard/caisse`, { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /accepter/i });
  if (await accept.count()) await accept.first().click().catch(() => {});

  // 1. Réponse perdue : le serveur enregistre, la caisse ne le sait pas.
  const before = await salesCount(page);
  let serverSale = null;
  await page.route(
    '**/api/boutique/sales',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      serverSale = (await response.json())?.data?.sale ?? null;
      await route.abort('failed');
    },
    { times: 1 },
  );
  await sellOne(page);
  const queuedAfterLoss = await queueLength(page);
  check(serverSale !== null, `réponse perdue : le serveur a bien enregistré la vente n°${serverSale?.number ?? '?'}`);
  check(queuedAfterLoss === 1, `réponse perdue : la caisse l'a mise en attente (${queuedAfterLoss} en file)`);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(3000);
  const afterReplay = await salesCount(page);
  check(afterReplay - before === 1, `réponse perdue : une seule vente créée au renvoi (${afterReplay - before})`);
  check((await queueLength(page)) === 0, 'réponse perdue : la file est vidée');
  await context.close();
}

// Contexte neuf, **sans aucune interception** : Playwright prévient que
// `page.route` détourne aussi les requêtes de l'agent de service, qui
// échappent alors à la coupure simulée. Mesuré : dans le même contexte, un
// écran jamais ouvert « s'ouvrait hors ligne » avec un statut 200 — il venait
// du réseau. Tout ce qui suit serait une fausse preuve.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, '/boutique/connexion', 'demo-boutique@demo.magyapro.app');
  await page.goto(`${BASE}/boutique/dashboard/caisse`, { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /accepter/i });
  if (await accept.count()) await accept.first().click().catch(() => {});
  const before = await salesCount(page);

  // 2. Écrans préparés d'avance.
  const warmed = await waitForPages(page, ['/boutique/dashboard/caisse', '/boutique/dashboard']);
  check(warmed.includes('/boutique/dashboard/caisse'), `écrans préparés : ${warmed.join(', ') || 'aucun'}`);

  // 3. Démarrage à froid hors ligne.
  await setNetwork(context, false);
  check(await networkIsDown(page), 'contrôle positif : le réseau est réellement coupé');
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(1500);
  const offlineTitle = await page.locator('h1').first().textContent().catch(() => null);
  check(/caisse/i.test(offlineTitle ?? ''), `caisse rechargée hors ligne : « ${offlineTitle ?? 'rien'} »`);
  check(await page.getByText('Hors connexion.').isVisible().catch(() => false), 'bandeau « Hors connexion » affiché');

  const beforeOffline = before;
  await sellOne(page);
  check((await queueLength(page)) === 1, 'vente hors ligne : mise en attente');

  await page.goto(`${BASE}/boutique/dashboard/produits`).catch(() => {});
  await page.waitForTimeout(1000);
  check(/produits/i.test((await page.locator('h1').first().textContent().catch(() => '')) ?? ''), 'produits : ouvert hors ligne');

  const unseen = await page.goto(`${BASE}/boutique/dashboard/finances`).catch((error) => error);
  await page.waitForTimeout(800);
  const fallback = await page.locator('h1').first().textContent().catch(() => null);
  check(
    fallback === 'Pas de connexion',
    `écran jamais enregistré : « ${fallback ?? 'erreur du navigateur'} » (statut ${unseen?.status?.() ?? unseen?.message}, agent ${unseen?.fromServiceWorker?.()}, ${page.url()})`,
  );

  // Retour du réseau : la vente part, une seule fois.
  await setNetwork(context, true);
  await page.goto(`${BASE}/boutique/dashboard/caisse`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const afterSync = await salesCount(page);
  check(afterSync - beforeOffline === 1, `retour du réseau : la vente hors ligne est créée une fois (${afterSync - beforeOffline})`);
  check((await queueLength(page)) === 0, 'retour du réseau : file vidée');

  // 5. Déconnexion.
  await page.getByRole('button', { name: /se déconnecter/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const left = await cachedPages(page);
  check(left.length === 0, `déconnexion : pages enregistrées effacées (${left.length} restante·s)`);
  await context.close();
}

// ================================================================= Restaurant
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, '/connexion', 'demo-chez-aminata@demo.magyapro.app');
  await page.goto(`${BASE}/dashboard/commandes`, { waitUntil: 'networkidle' });
  const warmed = await waitForPages(page, ['/dashboard/commandes', '/dashboard/cuisine', '/dashboard']);
  check(
    ['/dashboard/commandes', '/dashboard/cuisine', '/dashboard'].every((path) => warmed.includes(path)),
    `restaurant, écrans préparés : ${warmed.join(', ') || 'aucun'}`,
  );

  await setNetwork(context, false);
  check(await networkIsDown(page), 'restaurant, contrôle positif : réseau coupé');
  for (const [path, title] of [['/dashboard/commandes', /commandes/i], ['/dashboard/cuisine', /cuisine/i], ['/dashboard', /bonjour/i]]) {
    await page.goto(`${BASE}${path}`).catch(() => {});
    await page.waitForTimeout(1000);
    const heading = await page.locator('h1').first().textContent().catch(() => null);
    check(title.test(heading ?? ''), `restaurant, ${path} hors ligne : « ${heading ?? 'rien'} »`);
  }
  check(await page.getByText('Hors connexion.').isVisible().catch(() => false), 'restaurant : bandeau « Hors connexion » affiché');
  await context.close();
}

await browser.close();
relay.close();
console.log(report.join('\n'));
if (failures.length) {
  console.log(`\n${failures.length} échec(s).`);
  process.exitCode = 1;
} else {
  console.log('\n✓ hors connexion vérifié');
}
