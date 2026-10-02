/**
 * Sonde de la vidéo de présentation, sur la page Restaurant.
 *
 * Quatre promesses du composant, vérifiées dans un vrai navigateur plutôt que
 * relues dans le code :
 *
 * 1. **Rien n'est téléchargé avant le clic** — ni WebM, ni MP4. Seule
 *    l'affiche part au chargement.
 * 2. **La lecture fonctionne** : après le clic, une source est chargée et la
 *    vidéo avance réellement (`currentTime` > 0).
 * 3. **Aucune violation de la politique de sécurité** : une `media-src` trop
 *    stricte bloquerait la vidéo en silence, lecteur affiché mais vide.
 * 4. **Rien ne démarre seul** : à l'arrivée, la vidéo est en pause.
 *
 * Contrôle positif : la sonde vérifie qu'elle observe bien le réseau en
 * exigeant la requête de l'affiche. Sans elle, « aucune requête vidéo » ne
 * prouverait rien — une sonde aveugle n'en voit aucune non plus.
 *
 * Emploi : serveur lancé (`npm run start`), puis
 *   node scripts/audit-video.mjs
 */
import pw from 'playwright-core';

const { chromium } = pw;
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
const report = [];

for (const viewport of [
  { name: 'bureau', width: 1440, height: 900 },
  { name: 'téléphone', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const requests = [];
  const violations = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to load/i.test(message.text())) violations.push(message.text());
  });

  await page.goto(`${BASE}/restaurant`, { waitUntil: 'networkidle' });
  const video = page.locator('video').first();
  await video.scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');

  const before = requests.filter((url) => /\/videos\/.*\.(webm|mp4)/.test(url));
  const poster = requests.some((url) => url.includes('/videos/magyapro-restaurant-affiche.webp'));
  const paused = await video.evaluate((element) => element.paused);

  if (!poster) failures.push(`${viewport.name} : l'affiche n'a pas été demandée — sonde aveugle ?`);
  if (before.length) failures.push(`${viewport.name} : vidéo téléchargée avant le clic (${before.length} requête·s)`);
  if (!paused) failures.push(`${viewport.name} : la vidéo démarre seule`);

  // Le geste du visiteur.
  await video.evaluate((element) => element.play());
  await page.waitForTimeout(2500);
  const state = await video.evaluate((element) => ({
    time: element.currentTime,
    source: element.currentSrc.split('/').pop(),
    width: Math.round(element.getBoundingClientRect().width),
  }));
  if (!(state.time > 0.5)) failures.push(`${viewport.name} : la vidéo n'avance pas (t = ${state.time})`);
  if (violations.length) failures.push(`${viewport.name} : ${violations.length} violation(s) CSP — ${violations[0]}`);

  report.push(
    `${viewport.name.padEnd(10)} affiche ${poster ? 'oui' : 'NON'} · avant clic ${before.length} req. vidéo · ` +
      `en pause ${paused ? 'oui' : 'NON'} · lue : ${state.source} à ${state.time.toFixed(1)} s · ` +
      `largeur ${state.width} px · CSP ${violations.length}`,
  );

  await video.evaluate((element) => element.pause());
  await page.screenshot({ path: `${process.env.OUT_DIR ?? '.'}/video-${viewport.name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
console.log(report.join('\n'));
if (failures.length) {
  console.log(`\n${failures.length} échec(s) :`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ les quatre promesses tiennent, sur les deux largeurs');
}
