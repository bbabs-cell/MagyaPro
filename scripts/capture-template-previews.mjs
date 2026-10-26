/**
 * Aperçus des templates Restaurant — `public/templates/<clé>.webp`.
 *
 * Un aperçu de template doit montrer **le template**. Les premières vignettes
 * étaient des photos d'ambiance générées : belles, mais aucune ne montrait la
 * page que le restaurateur allait obtenir, et deux templates partageaient la
 * même image. Celles-ci sont des captures du vrai site, rendu avec les
 * restaurants de démonstration, posées dans un ordinateur et un téléphone.
 *
 * ## Pourquoi un script
 *
 * Même raison que `capture-pub.mjs` : un aperçu figé ment dès que le template
 * change. Quand un template évolue, on relance ce script dans la même PR et
 * l'aperçu suit.
 *
 * ## Emploi
 *
 *   npm run build && npm run start          # le serveur doit tourner
 *   npx prisma db seed                      # démos et leurs photos
 *   node scripts/capture-template-previews.mjs
 *
 * Le script change **temporairement** le template des restaurants de
 * démonstration de la base locale (il en faut un par template), puis remet
 * chacun dans son template d'origine, même en cas d'erreur.
 *
 * Il dépose aussi, pour la publicité Restaurant (`scripts/motion/pub.html`,
 * plan « 7 vitrines animées »), le haut de chaque vitrine sur téléphone :
 * `captures-pub/tpl-<clé>-tel.png`.
 *
 * Variables : BASE_URL (défaut http://localhost:3000, sous-domaines en
 * `<slug>.magyapro.localhost`), DATABASE_URL, CHROMIUM_PATH, CAPTURES_DIR
 * (défaut ./captures-pub).
 */
import pw from 'playwright-core';
import pg from 'pg';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const { chromium } = pw;

const PORT = new URL(process.env.BASE_URL ?? 'http://localhost:3000').port || '3000';
const OUT = `${process.cwd()}/public/templates`;
const CAPTURES = process.env.CAPTURES_DIR ?? `${process.cwd()}/captures-pub`;

/**
 * Chaque template, filmé sur la démo qui lui va : sa cuisine, ses photos et
 * sa couleur s'accordent avec l'identité du template. Fond de l'aperçu : les
 * deux couleurs que le template propose au restaurateur (`registry.ts`).
 *
 * L'ordinateur montre le héros ; le téléphone, la section qui signe le
 * template (`mobileAt`, un titre de la page) — sans quoi deux templates
 * sombres filmés sur la même démo se ressembleraient trop.
 */
const PLAN = [
  { key: 'modern', slug: 'demo-la-terrasse', bg: ['#e2483d', '#12151a'], mobileAt: 'Les plus commandés' },
  { key: 'african-premium', slug: 'demo-chez-aminata', bg: ['#c2410c', '#1c1917'], mobileAt: 'Nos incontournables' },
  { key: 'fast-food', slug: 'demo-burger-lab', bg: ['#dc2626', '#111827'] },
  { key: 'traditional', slug: 'demo-chez-aminata', bg: ['#7c2d12', '#1c1917'], mobileAt: 'Nos incontournables' },
  { key: 'elegant', slug: 'demo-la-terrasse', bg: ['#0f766e', '#0c0a09'], mobileAt: 'Notre sélection' },
  { key: 'street-food', slug: 'demo-burger-lab', bg: ['#e8281a', '#1a0f2e'], mobileAt: 'Les plus commandés' },
  { key: 'prestige', slug: 'demo-la-terrasse', bg: ['#cda45e', '#0c0b09'], mobileAt: 'Notre sélection' },
];

const W = 1600;
const H = 900;

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  return line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
}

/** Capture d'une vitrine, sans le bandeau « Restaurant de démonstration ». */
async function shoot(browser, slug, viewport, at) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await page.goto(`http://${slug}.magyapro.localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    for (const p of document.querySelectorAll('p')) {
      if (p.textContent?.startsWith('Restaurant de démonstration')) p.style.display = 'none';
    }
  });
  if (at) {
    // Le titre de la section en haut de l'écran, sous l'en-tête collant.
    await page.evaluate((text) => {
      const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === text);
      if (heading) window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 120);
    }, at);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  await page.close();
  return png;
}

const dataUrl = (png) => `data:image/png;base64,${png.toString('base64')}`;

/** L'aperçu : l'ordinateur à gauche, le téléphone devant, à droite. */
function composition(desktop, mobile, [from, to]) {
  return `<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: ${W}px; height: ${H}px; overflow: hidden;
      background: radial-gradient(120% 90% at 15% 10%, ${from} 0%, ${to} 70%); }
    .grain { position: absolute; inset: 0; opacity: .18;
      background-image: radial-gradient(rgba(255,255,255,.35) 1px, transparent 1.2px); background-size: 6px 6px; }
    .laptop { position: absolute; left: 110px; top: 92px; width: 1150px; border-radius: 18px; overflow: hidden;
      background: #1d1f24; box-shadow: 0 50px 90px -30px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08); }
    .bar { height: 40px; display: flex; align-items: center; gap: 9px; padding: 0 18px; background: #2a2d33; }
    .bar i { width: 12px; height: 12px; border-radius: 50%; background: #ff5f57; }
    .bar i:nth-child(2) { background: #febc2e; } .bar i:nth-child(3) { background: #28c840; }
    .bar b { margin-left: 18px; flex: 1; height: 22px; border-radius: 7px; background: #1d1f24; }
    .laptop img { display: block; width: 100%; }
    .phone { position: absolute; right: 120px; top: 150px; width: 318px; padding: 11px; border-radius: 52px;
      background: linear-gradient(135deg, #5b5f66, #17191d 45%, #4a4e55);
      box-shadow: 0 60px 90px -30px rgba(0,0,0,.7); }
    .phone .screen { border-radius: 42px; overflow: hidden; height: 640px; background: #000; }
    .phone img { display: block; width: 100%; }
  </style></head><body><div class="grain"></div>
    <div class="laptop"><div class="bar"><i></i><i></i><i></i><b></b></div><img src="${desktop}"></div>
    <div class="phone"><div class="screen"><img src="${mobile}"></div></div>
  </body></html>`;
}

mkdirSync(OUT, { recursive: true });
mkdirSync(CAPTURES, { recursive: true });
const db = new pg.Client({ connectionString: databaseUrl().replace(/\?schema=\w+$/, '') });
await db.connect();

const slugs = [...new Set(PLAN.map((entry) => entry.slug))];
const { rows: original } = await db.query('select slug, "templateKey" from restaurants where slug = any($1)', [slugs]);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  for (const entry of PLAN) {
    await db.query('update restaurants set "templateKey" = $1 where slug = $2', [entry.key, entry.slug]);
    const desktop = await shoot(browser, entry.slug, { width: 1440, height: 860 });
    const mobile = await shoot(browser, entry.slug, { width: 390, height: 800 }, entry.mobileAt);
    // Le haut de la vitrine, à la taille de l'écran du téléphone de la pub.
    writeFileSync(`${CAPTURES}/tpl-${entry.key}-tel.png`, await shoot(browser, entry.slug, { width: 390, height: 844 }));

    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.setContent(composition(dataUrl(desktop), dataUrl(mobile), entry.bg), { waitUntil: 'load' });
    const png = await page.screenshot({ type: 'png' });
    await page.close();

    const file = `${OUT}/${entry.key}.webp`;
    const info = await sharp(png).webp({ quality: 78, effort: 6 }).toFile(file);
    console.info(`✓ ${entry.key} (${entry.slug}) — ${Math.round(info.size / 1024)} Ko`);
  }
} finally {
  for (const row of original) {
    await db.query('update restaurants set "templateKey" = $1 where slug = $2', [row.templateKey, row.slug]);
  }
  await browser.close();
  await db.end();
}
