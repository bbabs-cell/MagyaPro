/**
 * Visuel du héros de la page Restaurant — `public/marketing/cuisine-*.webp`.
 *
 * L'écran de cuisine de MagyaPro, réellement rendu, sur trois appareils à la
 * fois : l'ordinateur de la caisse, la tablette du passe, le téléphone du
 * patron. C'est la promesse du héros (« de la commande à la cuisine ») montrée
 * telle qu'elle existe, là où un bon de commande dessiné ne faisait que
 * l'illustrer.
 *
 * Trois images, une par appareil (`cuisine-ordinateur`, `cuisine-tablette`,
 * `cuisine-telephone`), sur fond transparent : la page les pose et les anime
 * séparément (`components/marketing/kitchen-devices.tsx`). Le script affiche
 * la place de chacune dans la composition, en pourcentages, à reporter dans
 * ce composant si elle change.
 *
 * ## Emploi
 *
 *   npm run build && npm run start          # le serveur doit tourner
 *   npx prisma db seed                      # démos et comptes de démonstration
 *   node scripts/capture-hero-cuisine.mjs
 *
 * Pour que la cuisine ne soit pas vide, le script passe **temporairement**
 * quelques commandes terminées de Chez Aminata (base locale, vitrine de
 * démonstration) à « à préparer », « en préparation » et « prête », avec une
 * heure de commande récente — puis rend à chacune son statut et son heure,
 * même en cas d'erreur.
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
const SLUG = 'demo-chez-aminata';
const OUT = `${process.cwd()}/public/marketing`;

/** Le service de 20 h : deux bons à préparer, deux sur le feu, deux prêts. */
const SERVICE = [
  { status: 'CONFIRMED', minutesAgo: 2 },
  { status: 'CONFIRMED', minutesAgo: 4 },
  { status: 'PREPARING', minutesAgo: 8 },
  { status: 'PREPARING', minutesAgo: 12 },
  { status: 'READY', minutesAgo: 16 },
  { status: 'READY', minutesAgo: 19 },
];

const W = 1600;
const H = 1120;

function databaseUrl() {
  const raw =
    process.env.DATABASE_URL ??
    readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
  const host = new URL(raw).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    // Ce script modifie des commandes : jamais ailleurs qu'en local.
    throw new Error(`Refusé : la base visée est sur « ${host} », pas en local.`);
  }
  return raw.replace(/\?schema=\w+$/, '');
}

async function shoot(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}/dashboard/cuisine`, { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /accepter/i });
  if (await accept.count()) await accept.first().click().catch(() => {});
  await page.waitForTimeout(500);
  const png = await page.screenshot({ type: 'png' });
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Trois appareils sur fond transparent — le héros garde son propre fond.
 * L'ordinateur au fond, la tablette devant à droite, le téléphone devant à
 * gauche : la même cuisine, vue de partout.
 */
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
  `select o.id, o.status, o."placedAt" from orders o join restaurants r on r.id = o."restaurantId"
   where r.slug = $1 and r."isDemo" and o.status = 'COMPLETED' order by o."placedAt" desc limit $2`,
  [SLUG, SERVICE.length],
);
if (picked.length < SERVICE.length) throw new Error(`Pas assez de commandes terminées chez ${SLUG}.`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const [index, order] of picked.entries()) {
    const { status, minutesAgo } = SERVICE[index];
    await db.query(`update orders set status = $1, "placedAt" = now() - make_interval(mins => $2) where id = $3`, [
      status,
      minutesAgo,
      order.id,
    ]);
  }

  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const login = await context.newPage();
  await login.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
  await login.fill('input[name="email"]', `${SLUG}@demo.magyapro.app`);
  await login.fill('input[name="password"]', PASSWORD);
  await login.click('button[type="submit"]');
  await login.waitForURL((url) => new URL(url).pathname !== '/connexion', { timeout: 20_000 });
  await login.close();

  const desktop = await shoot(context, { width: 1440, height: 900 });
  const tablet = await shoot(context, { width: 1180, height: 820 });
  const phone = await shoot(context, { width: 390, height: 842 });
  await context.close();

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.2 });
  await page.setContent(composition(desktop, tablet, phone), { waitUntil: 'load' });
  mkdirSync(OUT, { recursive: true });

  // Chaque appareil à part, et sa place dans la composition.
  for (const [selector, name] of [['.laptop', 'ordinateur'], ['.tablet', 'tablette'], ['.phone', 'telephone']]) {
    const node = page.locator(selector);
    const box = await node.boundingBox();
    const png = await node.screenshot({ type: 'png', omitBackground: true });
    const info = await sharp(png).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(`${OUT}/cuisine-${name}.webp`);
    const pct = (value, total) => `${((value / total) * 100).toFixed(2)}%`;
    console.info(
      `✓ cuisine-${name}.webp — ${info.width}×${info.height}, ${Math.round(info.size / 1024)} Ko · ` +
        `left ${pct(box.x, W)}, top ${pct(box.y, H)}, width ${pct(box.width, W)}`,
    );
  }
  await page.close();
} finally {
  for (const order of picked) {
    await db.query('update orders set status = $1, "placedAt" = $2 where id = $3', [order.status, order.placedAt, order.id]);
  }
  await browser.close();
  await db.end();
}
