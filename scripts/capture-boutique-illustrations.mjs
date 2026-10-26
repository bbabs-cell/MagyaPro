/**
 * Illustrations « Comment ça fonctionne » de la page Boutique —
 * `public/marketing/boutique/etape-<n>.webp`.
 *
 * Les premières illustrations étaient générées : un « CREATE ACCOUNT » en
 * anglais, un « CREER » sans accent, et pour les deux dernières étapes un
 * faux écran générique à la place de la caisse. Celles-ci sont des captures
 * de l'application, posées dans un appareil : on voit ce qu'on va utiliser.
 *
 * ## Emploi
 *
 *   npm run build && npm run start          # le serveur doit tourner
 *   npx prisma db seed                      # boutiques de démonstration
 *   node scripts/capture-boutique-illustrations.mjs
 *
 * Les écrans de gestion sont pris dans la visite de démonstration (« Marché
 * du Coin »), sans compte : c'est la même porte que le bouton « Explorer le
 * tableau de bord » de la page Boutique.
 *
 * Variables : BASE_URL (défaut http://localhost:3000), CHROMIUM_PATH.
 */
import pw from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const { chromium } = pw;

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = `${process.cwd()}/public/marketing/boutique`;
const DEMO = 'demo-marche-du-coin';

/** Une étape, son écran, et l'appareil qui le porte. */
const STEPS = [
  { step: 1, path: '/boutique/inscription', device: 'phone', tour: false },
  { step: 2, path: '/boutique/dashboard/parametres', device: 'laptop', tour: true },
  { step: 3, path: '/boutique/dashboard/produits', device: 'laptop', tour: true },
  { step: 4, path: '/boutique/dashboard/caisse', device: 'tablet', tour: true },
];

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  laptop: { width: 1440, height: 900 },
  tablet: { width: 1180, height: 820 },
};

const W = 1200;
const H = 620;

/** Fond aux couleurs de la page Boutique : brun profond, lueur dorée. */
function composition(screen, device) {
  const frame = {
    phone: `<div class="phone"><img src="${screen}"></div>`,
    laptop: `<div class="laptop"><div class="lid"><img src="${screen}"></div><div class="base"></div></div>`,
    tablet: `<div class="tablet"><img src="${screen}"></div>`,
  }[device];
  return `<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: ${W}px; height: ${H}px; overflow: hidden;
      background: radial-gradient(90% 80% at 50% 0%, #6b4a1a 0%, #2a1f14 45%, #1c1712 75%); }
    body::before { content: ''; position: absolute; inset: 0; opacity: .14;
      background-image: radial-gradient(rgba(224,189,82,.5) 1px, transparent 1.2px); background-size: 18px 18px; }
    .phone { position: absolute; left: 50%; top: 56px; width: 300px; margin-left: -150px; padding: 12px; border-radius: 52px;
      background: linear-gradient(135deg, #5b5f66, #17191d 45%, #4a4e55); box-shadow: 0 50px 90px -30px rgba(0,0,0,.8); }
    .phone img { display: block; width: 100%; border-radius: 42px; }
    .laptop { position: absolute; left: 50%; top: 60px; width: 1040px; margin-left: -520px; }
    .lid { margin: 0 50px; padding: 14px 14px 18px; border-radius: 22px 22px 0 0; background: #15171b; box-shadow: inset 0 0 0 2px #2c2f35; }
    .lid img { display: block; width: 100%; border-radius: 5px; }
    .base { height: 24px; border-radius: 0 0 22px 22px; background: linear-gradient(#c9ccd2, #8d9198);
      box-shadow: 0 40px 70px -20px rgba(0,0,0,.7); }
    .tablet { position: absolute; left: 50%; top: 60px; width: 980px; margin-left: -490px; padding: 22px; border-radius: 40px;
      background: linear-gradient(135deg, #3b3e44, #121417 50%, #3b3e44); box-shadow: 0 50px 90px -30px rgba(0,0,0,.8); }
    .tablet img { display: block; width: 100%; border-radius: 18px; }
  </style></head><body>${frame}</body></html>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  // La visite de démonstration : une session sur « Marché du Coin », sans compte.
  const tour = await browser.newContext({ deviceScaleFactor: 1 });
  const opener = await tour.newPage();
  await opener.goto(`${BASE}/boutique`, { waitUntil: 'networkidle' });
  const status = await opener.evaluate(async (slug) => {
    const response = await fetch('/api/public/boutique/demo-tour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    return response.status;
  }, DEMO);
  if (status !== 200) throw new Error(`Visite de démonstration refusée (HTTP ${status}).`);
  await opener.close();
  const anonymous = await browser.newContext({ deviceScaleFactor: 1 });

  for (const entry of STEPS) {
    const context = entry.tour ? tour : anonymous;
    const page = await context.newPage();
    await page.setViewportSize(VIEWPORTS[entry.device]);
    await page.goto(`${BASE}${entry.path}`, { waitUntil: 'networkidle' });
    const accept = page.getByRole('button', { name: /accepter/i });
    if (await accept.count()) await accept.first().click().catch(() => {});
    // Le bandeau « Visite guidée… consultation uniquement » n'appartient
    // qu'à la démonstration : un vrai commerçant ne le voit jamais.
    await page.evaluate(() => {
      // Le plus grand élément qui commence par ce texte et reste une
      // simple barre (moins de 80 px de haut) : c'est le bandeau entier.
      const bars = [...document.querySelectorAll('body *')].filter(
        (node) => node.textContent?.trim().startsWith('Visite guidée') && node.getBoundingClientRect().height < 80,
      );
      for (const bar of bars) bar.style.display = 'none';
    });
    await page.waitForTimeout(500);
    const png = await page.screenshot({ type: 'png' });
    await page.close();

    const frame = await browser.newPage({ viewport: { width: W, height: H } });
    await frame.setContent(composition(`data:image/png;base64,${png.toString('base64')}`, entry.device), { waitUntil: 'load' });
    const shot = await frame.screenshot({ type: 'png' });
    await frame.close();

    const file = `${OUT}/etape-${entry.step}.webp`;
    const info = await sharp(shot).webp({ quality: 78, effort: 6 }).toFile(file);
    console.info(`✓ étape ${entry.step} (${entry.path}) — ${Math.round(info.size / 1024)} Ko`);
  }
} finally {
  await browser.close();
}
