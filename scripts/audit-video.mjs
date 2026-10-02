/**
 * Sonde de la vidéo de présentation, sur la page Restaurant ou Boutique.
 *
 * Lecture automatique en boucle, à la demande du propriétaire — mais à des
 * conditions que ce script vérifie dans un vrai navigateur, sur deux
 * largeurs :
 *
 * 1. **Rien n'est téléchargé tant qu'elle n'est pas à l'écran.** Elle est sous
 *    la ligne de flottaison ; un visiteur qui ne descend pas ne paie rien.
 * 2. **La bonne version pour la largeur** : 9:16 sur téléphone, 16:9 au-delà,
 *    et une seule affiche, téléchargée une seule fois.
 * 3. **Elle démarre seule, muette et en boucle**, une fois à l'écran.
 * 4. **Elle s'arrête quand elle sort de l'écran.**
 * 5. **Le geste du visiteur l'emporte** : mise en pause à la main, elle ne
 *    repart pas au défilement suivant.
 * 6. **Jamais en mouvement réduit** : elle reste à lancer d'un clic.
 * 7. **Jamais en économie de données** (`navigator.connection.saveData`).
 *
 * Et, sur tous les parcours, aucune violation de la politique de sécurité.
 *
 * Contrôle positif : la sonde exige la requête de l'affiche attendue, sans
 * quoi « aucune requête vidéo » ne prouverait rien — une sonde aveugle n'en
 * verrait aucune non plus.
 *
 * Emploi : serveur lancé (`npm run start`), puis
 *   node scripts/audit-video.mjs                    # page Restaurant
 *   node scripts/audit-video.mjs --page boutique    # page Boutique
 */
import pw from 'playwright-core';

const { chromium } = pw;
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PRODUCT = process.argv.includes('--page') && process.argv[process.argv.indexOf('--page') + 1] === 'boutique'
  ? 'boutique'
  : 'restaurant';
const PATH = PRODUCT === 'boutique' ? '/boutique' : '/restaurant';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
const report = [];
const fail = (message) => failures.push(message);

async function open(viewport, options = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    ...options,
  });
  const page = await context.newPage();
  const requests = [];
  const violations = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to load/i.test(message.text())) violations.push(message.text());
  });
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
  return { context, page, requests, violations };
}

const state = (video) =>
  video.evaluate((element) => ({
    paused: element.paused,
    time: element.currentTime,
    muted: element.muted,
    loop: element.loop,
    source: element.currentSrc.split('/').pop(),
  }));

for (const viewport of [
  { name: 'bureau', width: 1440, height: 900, expect: `magyapro-${PRODUCT}.webm` },
  { name: 'téléphone', width: 390, height: 844, expect: `magyapro-${PRODUCT}-vertical.webm` },
]) {
  const tag = viewport.name;
  const { context, page, requests, violations } = await open(viewport);
  const video = page.locator('video').first();
  const videoRequests = () => requests.filter((url) => /\/videos\/.*\.(webm|mp4)/.test(url));

  // 1. Arrivée en haut de page : la vidéo est hors de l'écran.
  await page.waitForTimeout(1500);
  const before = videoRequests().length;
  if (before) fail(`${tag} : ${before} requête(s) vidéo avant d'être à l'écran`);

  // 2. Le bon format, et une seule affiche.
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  const posters = requests.filter((url) => /\/videos\/.*affiche.*\.webp/.test(url)).length;
  if (posters === 0) fail(`${tag} : affiche jamais demandée — sonde aveugle ?`);
  if (posters > 1) fail(`${tag} : ${posters} affiches téléchargées pour une seule vidéo`);

  // 3. Démarrage automatique, muet, en boucle.
  const playing = await state(video);
  if (playing.paused || !(playing.time > 0.5)) fail(`${tag} : ne démarre pas à l'écran (t = ${playing.time})`);
  if (!playing.muted) fail(`${tag} : lecture automatique non muette`);
  if (!playing.loop) fail(`${tag} : pas en boucle`);
  if (playing.source !== viewport.expect) fail(`${tag} : source ${playing.source}, attendu ${viewport.expect}`);

  // 4. Hors de l'écran : en pause.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  const away = await state(video);
  if (!away.paused) fail(`${tag} : continue de jouer hors de l'écran`);

  // 5. Retour à l'écran : reprend. Puis pause du visiteur : ne repart plus.
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const back = await state(video);
  if (back.paused) fail(`${tag} : ne reprend pas en revenant à l'écran`);
  await video.evaluate((element) => element.pause());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const respected = await state(video);
  if (!respected.paused) fail(`${tag} : repart seule après une pause du visiteur`);

  if (violations.length) fail(`${tag} : ${violations.length} violation(s) CSP — ${violations[0]}`);

  report.push(
    `${tag.padEnd(10)} avant écran ${before} req. · ${playing.source} · ` +
      `démarre ${!playing.paused} (t=${playing.time.toFixed(1)}) · muette ${playing.muted} · boucle ${playing.loop} · ` +
      `hors écran en pause ${away.paused} · reprend ${!back.paused} · pause visiteur respectée ${respected.paused} · ` +
      `affiches ${posters} · CSP ${violations.length}`,
  );
  await context.close();
}

// 6. Mouvement réduit : rien ne démarre seul.
{
  const { context, page } = await open({ width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  const video = page.locator('video').first();
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  const reduced = await state(video);
  if (!reduced.paused) fail('mouvement réduit : la vidéo démarre seule');
  report.push(`mouvement réduit : en pause ${reduced.paused}`);
  await context.close();
}

// 7. Économie de données : rien ne démarre seul, rien ne se télécharge.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
  });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
  const video = page.locator('video').first();
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  const saving = await state(video);
  const fetched = requests.filter((url) => /\/videos\/.*\.(webm|mp4)/.test(url)).length;
  if (!saving.paused) fail('économie de données : la vidéo démarre seule');
  if (fetched) fail(`économie de données : ${fetched} requête(s) vidéo`);
  report.push(`économie de données : en pause ${saving.paused} · requêtes vidéo ${fetched}`);
  await page.screenshot({ path: `${process.env.OUT_DIR ?? '.'}/video-telephone-pause.png` });
  await context.close();
}

await browser.close();
console.log(`— page ${PATH}`);
console.log(report.join('\n'));
if (failures.length) {
  console.log(`\n${failures.length} échec(s) :`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ les sept comportements tiennent');
}
