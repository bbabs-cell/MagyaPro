/**
 * Mesure du temps de réponse au clic dans les tableaux de bord.
 *
 * Deux temps par navigation, parce qu'ils ne disent pas la même chose :
 *
 * - **retour** : le premier changement visible après le clic (adresse,
 *   squelette de chargement, nouveau titre). C'est ce qui fait dire « ça ne
 *   répond pas » : tant que rien ne bouge, le clic semble perdu.
 * - **prêt** : le titre de la page d'arrivée est affiché. C'est le temps du
 *   serveur et de la base.
 *
 * Emploi : serveur lancé (`npm run start`), base de démonstration en place.
 *   node scripts/audit-clics.mjs              # Boutique
 *   node scripts/audit-clics.mjs restaurant   # Restaurant, pour comparer
 *
 * Variables : BASE_URL, CHROMIUM_PATH, DEMO_PASSWORD, CPU (ralentissement
 * processeur, 4 par défaut — un téléphone d'entrée de gamme, pas un poste de
 * développeur), LATENCE (millisecondes ajoutées à chaque aller-retour).
 */
import pw from 'playwright-core';

const { chromium } = pw;
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo!2345';
const CPU = Number(process.env.CPU ?? 4);
const PRODUCT = process.argv[2] === 'restaurant' ? 'restaurant' : 'boutique';

const SETUP = {
  boutique: {
    login: '/boutique/connexion',
    email: 'demo-boutique@demo.magyapro.app',
    start: '/boutique/dashboard',
    links: [
      ['Caisse', '/boutique/dashboard/caisse'],
      ['Ventes', '/boutique/dashboard/ventes'],
      ['Produits', '/boutique/dashboard/produits'],
      ['Clients', '/boutique/dashboard/clients'],
      ['Vue d’ensemble', '/boutique/dashboard'],
    ],
  },
  restaurant: {
    login: '/connexion',
    email: 'demo-chez-aminata@demo.magyapro.app',
    start: '/dashboard',
    links: [
      ['Commandes', '/dashboard/commandes'],
      ['Cuisine', '/dashboard/cuisine'],
      ['Clients', '/dashboard/clients'],
      ['Vue d’ensemble', '/dashboard'],
    ],
  },
}[PRODUCT];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}${SETUP.login}`, { waitUntil: 'networkidle' });
await page.fill('input[name="email"]', SETUP.email);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((url) => new URL(url).pathname !== SETUP.login, { timeout: 20_000 });
await page.goto(`${BASE}${SETUP.start}`, { waitUntil: 'networkidle' });

const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
// LATENCE=300 : un aller-retour réseau de production (base et serveur
// distants), là où le silence après le clic se ressent vraiment.
const LATENCY = Number(process.env.LATENCE ?? 0);
if (LATENCY) {
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY, downloadThroughput: -1, uploadThroughput: -1 });
}

const rows = [];
for (const [label, href] of SETUP.links) {
  const link = page.locator(`aside a[href="${href}"]:visible, nav a[href="${href}"]:visible`).first();
  if (!(await link.count())) {
    rows.push(`${label.padEnd(16)} lien introuvable`);
    continue;
  }
  const before = await page.locator('main h1').first().textContent().catch(() => '');
  // Le premier changement visible : observé dans la page, au plus près du
  // rendu, plutôt que deviné depuis Playwright.
  await page.evaluate((title) => {
    window.__feedback = null;
    const start = performance.now();
    window.__clickAt = start;
    const check = () => {
      const h1 = document.querySelector('main h1')?.textContent ?? '';
      const skeleton = document.querySelector('main .animate-pulse');
      const pending = document.querySelector('[data-nav-pending="true"]');
      if (skeleton || pending || h1 !== title) window.__feedback = performance.now() - window.__clickAt;
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }, before);
  const t0 = Date.now();
  await link.click();
  await page.waitForURL((url) => new URL(url).pathname === href, { timeout: 30_000 });
  await page.waitForFunction((title) => {
    const h1 = document.querySelector('main h1')?.textContent ?? '';
    return h1 && h1 !== title && !document.querySelector('main .animate-pulse');
  }, before, { timeout: 30_000 }).catch(() => {});
  const ready = Date.now() - t0;
  const feedback = await page.evaluate(() => window.__feedback);
  rows.push(`${label.padEnd(16)} retour ${String(Math.round(feedback ?? ready)).padStart(5)} ms · prêt ${String(ready).padStart(5)} ms`);
  await page.waitForTimeout(400);
}

await browser.close();
console.log(`${PRODUCT} — processeur ralenti ×${CPU}${LATENCY ? `, latence ${LATENCY} ms` : ''}`);
console.log(rows.join('\n'));
