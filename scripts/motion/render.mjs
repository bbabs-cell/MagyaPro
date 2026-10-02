/**
 * Rendu de la vidéo de présentation MagyaPro Restaurant.
 *
 * Aucune intelligence artificielle, aucun service payant : la vidéo est une
 * page HTML (`scene.html`) animée par une fonction du temps, photographiée
 * image par image dans Chromium, et encodée par ffmpeg. C'est le même
 * principe que la contrainte fondatrice du produit — rien qui coûte à l'usage
 * — appliqué à sa propre communication.
 *
 * ## Pourquoi image par image
 *
 * Enregistrer l'écran pendant qu'une animation tourne donne un film qui
 * dépend de la vitesse de la machine : une image ratée, un saut, un rendu
 * différent à chaque fois. Ici on fixe l'instant, on photographie, on passe
 * au suivant. Le film est exact et reproductible.
 *
 * ## Emploi
 *
 *   npm run build                          # les polices du site
 *   node scripts/capture-pub.mjs           # les écrans réels
 *   node scripts/motion/render.mjs         # -> publicite/motion/
 *   node scripts/motion/render.mjs --essai 2,7.4,12,18.5,24
 *                                          # quelques images fixes, pour vérifier
 *   node scripts/motion/render.mjs --publier
 *                                          # rend, puis copie dans public/videos/
 *
 * Variables : CAPTURES_DIR (défaut ./captures-pub), OUT_DIR (défaut
 * ./publicite/motion), CHROMIUM_PATH.
 *
 * ## Sorties
 *
 * - `magyapro-restaurant.mp4` — H.264, lu partout ;
 * - `magyapro-restaurant.webm` — VP9, plus léger pour le site ;
 * - `magyapro-restaurant-affiche.png` — l'image d'attente du lecteur, prise
 *   sur la dernière image, qui reprend la composition du hero.
 *
 * La vidéo est muette, et c'est voulu : une vidéo en lecture automatique sur
 * un site n'a le droit de démarrer que muette.
 */
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import pw from 'playwright-core';

const { chromium } = pw;

const FPS = 30;
const W = 1920;
const H = 1080;
const OUT = process.env.OUT_DIR ?? 'publicite/motion';
const CAPTURES = process.env.CAPTURES_DIR ?? 'captures-pub';
const NAME = 'magyapro-restaurant';

const SCREENS = {
  menu: '02-menu-client-tel.png',
  cuisine: '15-cuisine-tel.png',
};

const BRAND_FAMILIES = ['Bricolage Grotesque', 'Manrope', 'DM Mono'];

/**
 * Les `@font-face` du site, relus dans son build — les fichiers exacts que
 * voit un visiteur, sans réseau. Même raisonnement que pour le carton de la
 * publicité : Google Fonts n'est pas joignable depuis le navigateur de rendu,
 * qui retombait en silence sur une police système.
 */
function brandFontFaces() {
  const dir = '.next/static/css';
  if (!existsSync(dir)) throw new Error('Build introuvable : lancez « npm run build ».');
  const media = `file://${resolve('.next/static/media')}/`;
  const faces = readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .flatMap((file) => readFileSync(`${dir}/${file}`, 'utf8').match(/@font-face\{[^}]*\}/g) ?? [])
    .filter((face) => BRAND_FAMILIES.some((family) => face.includes(`font-family:${family};`)))
    .map((face) => face.replaceAll('url(/_next/static/media/', `url(${media}`));
  if (faces.length === 0) throw new Error('Aucune déclaration @font-face de la marque dans le build.');
  return faces.join('\n');
}

async function openScene(browser) {
  for (const file of Object.values(SCREENS)) {
    if (!existsSync(`${CAPTURES}/${file}`)) {
      throw new Error(`Capture manquante : ${CAPTURES}/${file} — lancez « node scripts/capture-pub.mjs ».`);
    }
  }

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`file://${resolve('scripts/motion/scene.html')}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: brandFontFaces() });

  await page.evaluate(
    async ({ menu, cuisine }) => {
      const load = (id, src) =>
        new Promise((done, fail) => {
          const img = document.getElementById(id);
          img.onload = () => img.decode().then(done, done);
          img.onerror = () => fail(new Error(`Image illisible : ${src}`));
          img.src = src;
        });
      await Promise.all([load('scr-menu', menu), load('scr-cuisine', cuisine)]);
    },
    {
      menu: `file://${resolve(CAPTURES, SCREENS.menu)}`,
      cuisine: `file://${resolve(CAPTURES, SCREENS.cuisine)}`,
    },
  );

  // Vérification qui peut échouer : `load()` rend la liste des polices
  // réellement chargées, vide si le navigateur est retombé sur une police
  // système. (`check()` répond « vrai » pour une famille absente.)
  const missing = await page.evaluate(async (specs) => {
    const result = [];
    for (const spec of specs) {
      const faces = await document.fonts.load(spec);
      if (faces.length === 0 || faces.some((face) => face.status !== 'loaded')) result.push(spec);
    }
    return result;
  }, ['800 84px "Bricolage Grotesque"', '500 52px "DM Mono"', '400 22px "DM Mono"', '500 30px "Manrope"']);
  if (missing.length) {
    throw new Error(`Police(s) de la marque non chargée(s) : ${missing.join(', ')}. Rendu refusé.`);
  }

  return page;
}

async function frame(page, t) {
  await page.evaluate((time) => window.render(time), t);
  return page.screenshot({ type: 'png' });
}

function encoder(args, label) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((ok, fail) =>
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${label} : ffmpeg a échoué (${code}).`)))),
  );
  return { child, done };
}

async function write(stream, buffer) {
  if (!stream.write(buffer)) await new Promise((ok) => stream.once('drain', ok));
}

/**
 * Copie la vidéo là où la page de présentation la lit.
 *
 * L'affiche passe en WebP : c'est le seul fichier que le visiteur télécharge
 * au chargement de la page (la vidéo est en `preload="none"`), et un PNG de
 * 1920 × 1080 pèserait dix fois plus pour la même image.
 */
function publish() {
  const target = 'public/videos';
  mkdirSync(target, { recursive: true });
  for (const ext of ['mp4', 'webm']) copyFileSync(`${OUT}/${NAME}.${ext}`, `${target}/${NAME}.${ext}`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', `${OUT}/${NAME}-affiche.png`, '-c:v', 'libwebp', '-quality', '86',
    `${target}/${NAME}-affiche.webp`]);
  for (const file of readdirSync(target)) {
    console.log(`  publié : ${target}/${file} — ${(statSync(`${target}/${file}`).size / 1024).toFixed(0)} Ko`);
  }
}

async function main() {
  const essai = (() => {
    const index = process.argv.indexOf('--essai');
    if (index === -1) return null;
    return (process.argv[index + 1] ?? '').split(',').map(Number).filter(Number.isFinite);
  })();

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  try {
    const page = await openScene(browser);
    const duration = await page.evaluate(() => window.DURATION);

    if (essai) {
      for (const t of essai) {
        const path = `${OUT}/essai-${String(t).replace('.', '_')}s.png`;
        await page.evaluate((time) => window.render(time), t);
        await page.screenshot({ path });
        console.log(`  ✓ ${path}`);
      }
      return;
    }

    // Une seule passe de rendu, deux encodages en parallèle : les images ne
    // sont photographiées qu'une fois.
    const input = ['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];
    const mp4 = encoder(
      [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'animation',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/${NAME}.mp4`],
      'MP4',
    );
    const webm = encoder(
      [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1',
        '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', `${OUT}/${NAME}.webm`],
      'WebM',
    );

    const total = Math.round(duration * FPS);
    const started = Date.now();
    let last;
    for (let index = 0; index < total; index += 1) {
      last = await frame(page, index / FPS);
      await write(mp4.child.stdin, last);
      await write(webm.child.stdin, last);
      if (index % FPS === 0) {
        process.stdout.write(`\r  ${Math.round((index / total) * 100)} % — ${(index / FPS).toFixed(0)} s / ${duration} s`);
      }
    }
    mp4.child.stdin.end();
    webm.child.stdin.end();
    await Promise.all([mp4.done, webm.done]);
    process.stdout.write(`\r  100 % — rendu en ${((Date.now() - started) / 1000).toFixed(0)} s\n`);

    // L'affiche : la dernière image, qui reprend la composition du hero.
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-sseof', '-0.1', '-i', `${OUT}/${NAME}.mp4`, '-frames:v', '1', `${OUT}/${NAME}-affiche.png`]);

    for (const ext of ['mp4', 'webm']) {
      const file = `${OUT}/${NAME}.${ext}`;
      console.log(`  ${file} — ${(statSync(file).size / 1024 / 1024).toFixed(1)} Mo`);
    }
    console.log(`  ${OUT}/${NAME}-affiche.png`);

    if (process.argv.includes('--publier')) publish();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
