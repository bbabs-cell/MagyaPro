/**
 * Illustrations « Comment ça fonctionne » de la page Restaurant —
 * `public/marketing/restaurant/etape-<n>.webp`.
 *
 * Le pendant de `capture-boutique-illustrations.mjs`. Les premières
 * illustrations étaient des dessins génériques (un personnage à son bureau,
 * une devanture, une tablette entourée de burgers) envoyés en administration.
 * Celles-ci sont des captures de l'application, posées dans un appareil : on
 * voit ce qu'on va utiliser à chaque étape.
 *
 * ## Emploi
 *
 *   npm run build && npm run start          # le serveur doit tourner
 *   npx prisma db seed                      # restaurants de démonstration
 *   node scripts/capture-restaurant-illustrations.mjs
 *
 * Les écrans de gestion sont pris avec le compte de démonstration de « Chez
 * Aminata », le site publié sur sa vitrine (`<slug>.magyapro.localhost`).
 *
 * Variables : BASE_URL (défaut http://localhost:3000), SITE_HOST (défaut
 * magyapro.localhost:3000), CHROMIUM_PATH, DEMO_PASSWORD.
 */
import pw from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const { chromium } = pw;

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SITE_HOST = process.env.SITE_HOST ?? 'magyapro.localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo!2345';
const SLUG = 'demo-chez-aminata';
const OUT = `${process.cwd()}/public/marketing/restaurant`;

/** Une étape, son écran, et l'appareil qui le porte. */
const STEPS = [
  { step: 1, url: `${BASE}/inscription`, device: 'phone', signedIn: false },
  { step: 2, url: `${BASE}/dashboard/parametres`, device: 'laptop', signedIn: true },
  { step: 3, url: `${BASE}/dashboard/menu`, device: 'laptop', signedIn: true },
  { step: 4, url: `http://${SLUG}.${SITE_HOST}/`, device: 'phone', signedIn: false },
];

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  laptop: { width: 1440, height: 900 },
};

const W = 1200;
const H = 620;

/** Fond aux couleurs de la page Restaurant : bleu nuit, lueur orangée. */
function composition(screen, device) {
  const frame = {
    phone: `<div class="phone"><img src="${screen}"></div>`,
    laptop: `<div class="laptop"><div class="lid"><img src="${screen}"></div><div class="base"></div></div>`,
  }[device];
  return `<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: ${W}px; height: ${H}px; overflow: hidden;
      background: radial-gradient(90% 80% at 50% 0%, #a2461f 0%, #1a2440 48%, #0b1730 78%); }
    body::before { content: ''; position: absolute; inset: 0; opacity: .14;
      background-image: radial-gradient(rgba(255,154,77,.5) 1px, transparent 1.2px); background-size: 18px 18px; }
    .phone { position: absolute; left: 50%; top: 56px; width: 300px; margin-left: -150px; padding: 12px; border-radius: 52px;
      background: linear-gradient(135deg, #5b5f66, #17191d 45%, #4a4e55); box-shadow: 0 50px 90px -30px rgba(0,0,0,.8); }
    .phone img { display: block; width: 100%; border-radius: 42px; }
    .laptop { position: absolute; left: 50%; top: 60px; width: 1040px; margin-left: -520px; }
    .lid { margin: 0 50px; padding: 14px 14px 18px; border-radius: 22px 22px 0 0; background: #15171b; box-shadow: inset 0 0 0 2px #2c2f35; }
    .lid img { display: block; width: 100%; border-radius: 5px; }
    .base { height: 24px; border-radius: 0 0 22px 22px; background: linear-gradient(#c9ccd2, #8d9198);
      box-shadow: 0 40px 70px -20px rgba(0,0,0,.7); }
  </style></head><body>${frame}</body></html>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  const owner = await browser.newContext({ deviceScaleFactor: 1 });
  const login = await owner.newPage();
  await login.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
  await login.fill('input[name="email"]', `${SLUG}@demo.magyapro.app`);
  await login.fill('input[name="password"]', PASSWORD);
  await login.click('button[type="submit"]');
  await login.waitForURL((url) => new URL(url).pathname !== '/connexion', { timeout: 20_000 });
  await login.close();
  const anonymous = await browser.newContext({ deviceScaleFactor: 1 });

  for (const entry of STEPS) {
    const page = await (entry.signedIn ? owner : anonymous).newPage();
    await page.setViewportSize(VIEWPORTS[entry.device]);
    await page.goto(entry.url, { waitUntil: 'networkidle' });
    const accept = page.getByRole('button', { name: /accepter/i });
    if (await accept.count()) await accept.first().click().catch(() => {});
    // Le bandeau « Restaurant de démonstration… » n'appartient qu'à la
    // vitrine de démonstration : le site d'un vrai restaurant ne l'a pas.
    await page.evaluate(() => {
      for (const node of document.querySelectorAll('body *')) {
        const text = node.textContent?.trim() ?? '';
        if (text.startsWith('Restaurant de démonstration —') && node.getBoundingClientRect().height < 80) node.style.display = 'none';
      }
    });
    await page.waitForTimeout(900);
    const png = await page.screenshot({ type: 'png' });
    await page.close();

    const frame = await browser.newPage({ viewport: { width: W, height: H } });
    await frame.setContent(composition(`data:image/png;base64,${png.toString('base64')}`, entry.device), { waitUntil: 'load' });
    const shot = await frame.screenshot({ type: 'png' });
    await frame.close();

    const info = await sharp(shot).webp({ quality: 78, effort: 6 }).toFile(`${OUT}/etape-${entry.step}.webp`);
    console.info(`✓ étape ${entry.step} (${entry.url}) — ${Math.round(info.size / 1024)} Ko`);
  }
} finally {
  await browser.close();
}
