/**
 * Visuel du héros de la page Boutique — `public/marketing/boutique/hero-*.webp`.
 *
 * Le pendant de `capture-hero-cuisine.mjs` côté Boutique : MagyaPro Boutique,
 * réellement rendu, sur les trois appareils d'un commerce — l'ordinateur du
 * bureau (la vue d'ensemble), la tablette du comptoir (la caisse, un sac de
 * sucre au panier), le téléphone du gérant (les ruptures à venir).
 *
 * Trois images sur fond transparent, posées et animées séparément par
 * `components/marketing/boutique-devices.tsx`. Le script affiche la place de
 * chacune dans la composition, en pourcentages, à reporter dans ce composant
 * si elle change.
 *
 * ## Emploi
 *
 *   npm run build && npm run start          # le serveur doit tourner
 *   npx prisma db seed                      # vitrines Boutique
 *   node scripts/capture-hero-boutique.mjs
 *
 * Le compte propriétaire de « Marché du Coin » doit avoir un abonnement actif
 * en local : la visite guidée, elle, affiche « Bonjour Visiteur » et une caisse
 * désactivée, qui n'ont rien à faire sur la page d'accueil.
 *
 * Pour que la journée ne soit pas vide, le script ramène **temporairement**
 * les quatre dernières ventes de la boutique à aujourd'hui — puis rend à
 * chacune son heure, même en cas d'erreur. Base locale uniquement.
 *
 * Variables : BASE_URL (défaut http://localhost:3000), DATABASE_URL,
 * CHROMIUM_PATH, DEMO_PASSWORD.
 */
import pw from 'playwright-core';
import pg from 'pg';
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const { chromium } = pw;

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo!2345';
const SLUG = 'demo-marche-du-coin';
const OUT = `${process.cwd()}/public/marketing/boutique`;

/** Les ventes ramenées à aujourd'hui : il y a 25 min, 1 h 10, 2 h, 3 h 30. */
const TODAY = [25, 70, 120, 210];

const W = 1600;
const H = 1120;

function databaseUrl() {
  const raw =
    process.env.DATABASE_URL ??
    readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
  const host = new URL(raw).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    // Ce script modifie des ventes : jamais ailleurs qu'en local.
    throw new Error(`Refusé : la base visée est sur « ${host} », pas en local.`);
  }
  return raw.replace(/\?schema=\w+$/, '');
}

async function open(context, path, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /accepter/i });
  if (await accept.count()) await accept.first().click().catch(() => {});
  return page;
}

async function shoot(page) {
  await page.waitForTimeout(500);
  const png = await page.screenshot({ type: 'png' });
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** Même disposition que la cuisine : ordinateur au fond, tablette et téléphone devant. */
function composition(desktop, tablet, phone) {
  return `<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: transparent; }
    .laptop { position: absolute; left: 80px; top: 40px; width: 1360px; }
    .lid { margin: 0 70px; padding: 18px 18px 22px; border-radius: 26px 26px 0 0; background: #15171b;
      box-shadow: inset 0 0 0 2px #2c2f35; }
    .lid img { display: block; width: 100%; border-radius: 6px; }
    .base { position: relative; height: 30px; border-radius: 0 0 26px 26px;
      background: linear-gradient(#c9ccd2, #8d9198); }
    .base::before { content: ''; position: absolute; left: 50%; top: 0; width: 200px; height: 10px; margin-left: -100px;
      border-radius: 0 0 12px 12px; background: #a6aab1; }
    .tablet { position: absolute; right: 30px; top: 470px; width: 760px; padding: 22px; border-radius: 40px;
      background: linear-gradient(135deg, #3b3e44, #121417 50%, #3b3e44);
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.12); }
    .tablet img { display: block; width: 100%; border-radius: 18px; }
    .phone { position: absolute; left: 40px; top: 470px; width: 300px; padding: 11px; border-radius: 50px;
      background: linear-gradient(135deg, #5b5f66, #17191d 45%, #4a4e55);
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.14); }
    .phone .screen { height: 600px; overflow: hidden; border-radius: 40px; background: #000; }
    .phone img { display: block; width: 100%; }
  </style></head><body>
    <div class="laptop"><div class="lid"><img src="${desktop}"></div><div class="base"></div></div>
    <div class="tablet"><img src="${tablet}"></div>
    <div class="phone"><div class="screen"><img src="${phone}"></div></div>
  </body></html>`;
}

const db = new pg.Client({ connectionString: databaseUrl() });
await db.connect();

const { rows: picked } = await db.query(
  `select bs.id, bs."createdAt" from boutique_sales bs join stores s on s.id = bs."storeId"
   where s.slug = $1 and s."isDemo" and bs.status = 'COMPLETED' order by bs."createdAt" desc limit $2`,
  [SLUG, TODAY.length],
);
if (picked.length < TODAY.length) throw new Error(`Pas assez de ventes chez ${SLUG} — lancez le seed.`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const [index, sale] of picked.entries()) {
    await db.query(`update boutique_sales set "createdAt" = now() - make_interval(mins => $1) where id = $2`, [
      TODAY[index],
      sale.id,
    ]);
  }

  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const login = await context.newPage();
  await login.goto(`${BASE}/boutique/connexion`, { waitUntil: 'networkidle' });
  await login.fill('input[name="email"]', `${SLUG}@demo.magyapro.app`);
  await login.fill('input[name="password"]', PASSWORD);
  await login.click('button[type="submit"]');
  await login.waitForURL((url) => new URL(url).pathname !== '/boutique/connexion', { timeout: 20_000 });
  if (!new URL(login.url()).pathname.startsWith('/boutique/dashboard') || login.url().includes('abonnement')) {
    throw new Error(`Connexion arrivée sur ${login.url()} : il faut un abonnement actif à ${SLUG} en local.`);
  }
  await login.close();

  const desktop = await shoot(await open(context, '/boutique/dashboard', { width: 1440, height: 900 }));

  // Au comptoir : un sac de sucre et une boîte de tomate au panier. Le
  // panier vit dans la page ; rien n'est encaissé.
  const counter = await open(context, '/boutique/dashboard/caisse', { width: 1180, height: 820 });
  for (const [product, unit] of [['Sucre en poudre', /sac/i], ['Tomate concentrée', /boîte/i]]) {
    const card = counter.locator('div', { hasText: product }).filter({ has: counter.getByRole('button', { name: unit }) }).last();
    await card.getByRole('button', { name: unit }).first().click();
  }
  const tablet = await shoot(counter);

  const phone = await shoot(await open(context, '/boutique/dashboard/previsions', { width: 390, height: 842 }));
  await context.close();

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.2 });
  await page.setContent(composition(desktop, tablet, phone), { waitUntil: 'load' });
  mkdirSync(OUT, { recursive: true });

  for (const [selector, name] of [['.laptop', 'ordinateur'], ['.tablet', 'tablette'], ['.phone', 'telephone']]) {
    const node = page.locator(selector);
    const box = await node.boundingBox();
    const png = await node.screenshot({ type: 'png', omitBackground: true });
    const info = await sharp(png).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(`${OUT}/hero-${name}.webp`);
    const pct = (value, total) => `${((value / total) * 100).toFixed(2)}%`;
    console.info(
      `✓ hero-${name}.webp — ${info.width}×${info.height}, ${Math.round(info.size / 1024)} Ko · ` +
        `left ${pct(box.x, W)}, top ${pct(box.y, H)}, width ${pct(box.width, W)}`,
    );
  }
  await page.close();
} finally {
  for (const sale of picked) {
    await db.query('update boutique_sales set "createdAt" = $1 where id = $2', [sale.createdAt, sale.id]);
  }
  await browser.close();
  await db.end();
}
