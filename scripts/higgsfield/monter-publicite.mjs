/**
 * Montage de la publicité « Le papier perdu ».
 *
 * Assemble, dans l'ordre du dossier (`docs/PUBLICITE.md`, §4), les plans
 * produits par `produire-publicite.ts`, les inserts d'écran et le carton
 * final, en un seul fichier vertical.
 *
 * ## Les inserts sont le produit réel
 *
 * Sur les plans 4 à 8, l'image bascule sur une capture réelle de MagyaPro
 * pendant que la voix continue : le restaurateur parle, on voit l'écran dont
 * il parle. Ces captures viennent de `scripts/capture-pub.mjs`, prises sur
 * l'application construite. Aucune interface n'est générée par un modèle.
 *
 * ## Une publicité incomplète n'est pas une publicité
 *
 * Par défaut, le montage refuse de produire un fichier s'il manque un plan :
 * un film qui saute du plan 2 au plan 5 ne se diffuse pas, et le laisser
 * sortir sous le nom de la publicité finale serait le meilleur moyen qu'il
 * finisse en ligne par erreur. `--apercu` assemble ce qui existe, sous un
 * autre nom de fichier, pour juger du rythme et des inserts avant d'avoir
 * tout payé.
 *
 * ## Emploi
 *
 *   node scripts/higgsfield/monter-publicite.mjs            # film complet
 *   node scripts/higgsfield/monter-publicite.mjs --apercu   # ce qui existe
 *
 * Variables : CAPTURES_DIR (défaut ./captures-pub), OUT_DIR (défaut
 * ./publicite), CHROMIUM_PATH pour le rendu du carton.
 *
 * Aucun appel à Higgsfield, aucun identifiant lu : ce script ne coûte rien.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pw from 'playwright-core';

const { chromium } = pw;

const OUT = process.env.OUT_DIR ?? 'publicite';
const CAPTURES = process.env.CAPTURES_DIR ?? 'captures-pub';
const WORK = `${OUT}/montage`;
const PREVIEW = process.argv.includes('--apercu');

const W = 720;
const H = 1280;
const FPS = 24;
const RATE = 48000;

/**
 * Le découpage du §4. `insert` nomme la capture qui prend le cadre, et `at`
 * la fraction du plan à partir de laquelle elle le prend : le visage installe
 * la phrase, l'écran la prouve.
 */
const EDIT = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  // Pas la vue d'ensemble : elle affiche un chiffre d'affaires et une
  // variation sur trente jours. Un indicateur en rouge contredit le message,
  // et un montant à l'écran se lit comme une preuve de résultats — ce que le
  // dossier s'interdit, puisque rien n'est encore vendu.
  { id: 4, insert: '11-commandes-tel.png', at: 0.45 },
  { id: 5, insert: '15-cuisine-tel.png', at: 0.3 },
  { id: 6, insert: '13-carte-tel.png', at: 0.5 },
  { id: 7, insert: '02-menu-client-tel.png', at: 0.3 },
  { id: 8, insert: '12-prise-de-commande-tel.png', at: 0.4 },
];

/** Durée du carton final, en secondes. */
const CARD_SECONDS = 3;

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function duration(file) {
  return Number(
    execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
    ]).toString().trim(),
  );
}

/** Format commun à tous les segments, sans quoi la concaténation échoue. */
const VIDEO_OUT = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-preset', 'medium', '-crf', '18'];
const AUDIO_OUT = ['-c:a', 'aac', '-ar', String(RATE), '-ac', '2', '-b:a', '160k'];

async function download(url, file) {
  if (existsSync(file)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}) : ${url}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

/** Un plan sans insert : seulement remis au format commun. */
function plain(source, target) {
  ffmpeg([
    '-i', source,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1`,
    '-af', `aresample=${RATE}`,
    ...VIDEO_OUT, ...AUDIO_OUT, target,
  ]);
}

/**
 * Un plan avec insert : le visage, puis la capture, sous une seule voix.
 *
 * La capture fait 780 px de large pour 1 688 de haut — plus étroite que le
 * cadre 9:16. Elle est mise à la largeur, puis rognée **par le haut** : c'est
 * là que se trouvent l'en-tête et le contenu principal de chaque écran, et un
 * bas d'écran coupé ne fait rien perdre. Un zoom lent (4 %) la garde vivante
 * sans qu'on le remarque ; un plan fixe sur une capture fait diaporama.
 */
function withInsert(source, image, at, target) {
  const total = duration(source);
  const split = Math.round(total * at * FPS) / FPS;
  const rest = total - split;
  const frames = Math.round(rest * FPS);

  ffmpeg([
    '-i', source,
    '-loop', '1', '-t', String(rest), '-i', image,
    '-filter_complex',
    [
      `[0:v]trim=0:${split},setpts=PTS-STARTPTS,` +
        `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1[face]`,
      // Mise à l'échelle double avant le zoom : `zoompan` sur une image à la
      // taille finale produit un léger tremblement, visible sur du texte.
      `[1:v]scale=${W * 2}:-1,crop=${W * 2}:${H * 2}:0:0,` +
        `zoompan=z='1+0.04*on/${frames}':x='iw/2-(iw/zoom/2)':y='0':d=${frames}:s=${W}x${H}:fps=${FPS},` +
        `setsar=1,trim=duration=${rest}[screen]`,
      '[face][screen]concat=n=2:v=1:a=0[v]',
      `[0:a]atrim=0:${total},asetpts=PTS-STARTPTS,aresample=${RATE}[a]`,
    ].join(';'),
    '-map', '[v]', '-map', '[a]',
    ...VIDEO_OUT, ...AUDIO_OUT, target,
  ]);
}

/** Les trois familles de la marque, telles que `next/font` les nomme. */
const BRAND_FAMILIES = ['Bricolage Grotesque', 'Manrope', 'DM Mono'];

/**
 * Les déclarations `@font-face` du site, relues dans son propre build.
 *
 * Une première version chargeait les polices depuis Google Fonts. Le
 * navigateur de rendu n'y accédait pas, retombait en silence sur Liberation
 * Sans et DejaVu, et le carton sortait dans une typographie qui n'est pas la
 * marque. Les fichiers servis par le site, eux, sont sur le disque après
 * `npm run build` : ce sont exactement ceux que voit un visiteur, sans réseau
 * et sans seconde source qui pourrait diverger.
 */
function brandFontFaces() {
  const dir = '.next/static/css';
  if (!existsSync(dir)) {
    throw new Error('Build introuvable : lancez « npm run build » avant le montage (polices du carton).');
  }
  const media = `file://${resolve('.next/static/media')}/`;
  const faces = readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .flatMap((file) => readFileSync(`${dir}/${file}`, 'utf8').match(/@font-face\{[^}]*\}/g) ?? [])
    .filter((face) => BRAND_FAMILIES.some((family) => face.includes(`font-family:${family};`)))
    .map((face) => face.replaceAll('url(/_next/static/media/', `url(${media}`));
  if (faces.length === 0) {
    throw new Error('Aucune déclaration @font-face de la marque dans le build.');
  }
  return faces.join('\n');
}

/**
 * Le carton final, rendu par le navigateur plutôt que par `drawtext`.
 *
 * `drawtext` n'accepte que des fichiers de police locaux, et ceux du site
 * sont en woff2. Le navigateur compose avec les vraies polices de la marque,
 * gère le crénage, et le résultat est le même objet typographique que la
 * page de présentation.
 */
async function renderCard(png) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${brandFontFaces()}</style>
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: #0b1730; }
  body {
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 64px; box-sizing: border-box; color: #fff;
    background-image: radial-gradient(circle, rgba(255,255,255,.07) 1px, transparent 1px);
    background-size: 26px 26px;
  }
  .brand { font: 500 22px/1 'DM Mono', monospace; letter-spacing: .28em; text-transform: uppercase; color: #ff9a4d; }
  h1 { margin: 36px 0 0; font: 800 76px/0.98 'Bricolage Grotesque', sans-serif; letter-spacing: -0.03em; }
  h1 span { display: block; font: 500 58px/1.1 'DM Mono', monospace; letter-spacing: -0.01em; color: #ff9a4d; margin: 6px 0; }
  .cta { margin-top: 64px; display: inline-flex; align-self: flex-start; padding: 22px 34px; border-radius: 18px;
         background: #ff5e2e; font: 600 28px/1 'Manrope', sans-serif; }
  .url { margin-top: 28px; font: 500 26px/1 'Manrope', sans-serif; color: rgba(255,255,255,.7); }
</style></head><body>
  <div class="brand">MagyaPro Restaurant</div>
  <h1>De la commande<span>à la cuisine</span>sans un papier perdu.</h1>
  <div class="cta">Un mois gratuit</div>
  <div class="url">magyapro.com · sans carte bancaire</div>
</body></html>`;

  // Écrit sur le disque plutôt que passé en `setContent` : une page
  // `about:blank` n'a pas le droit de charger des fichiers `file://`.
  const htmlFile = resolve(`${WORK}/carton.html`);
  writeFileSync(htmlFile, html);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`file://${htmlFile}`, { waitUntil: 'load' });

  /**
   * La vérification doit pouvoir échouer.
   *
   * La première version employait `document.fonts.check()`, qui répond
   * « vrai » pour une famille absente : il n'y a alors rien à attendre, donc
   * rien de manquant. Le carton est sorti en police de substitution avec une
   * garde au vert. `document.fonts.load()` rend, lui, la liste des polices
   * réellement chargées pour une déclaration — vide si le navigateur est
   * retombé sur une police système.
   */
  const missing = await page.evaluate(async (specs) => {
    const result = [];
    for (const spec of specs) {
      const faces = await document.fonts.load(spec);
      if (faces.length === 0 || faces.some((face) => face.status !== 'loaded')) result.push(spec);
    }
    return result;
  }, ['800 76px "Bricolage Grotesque"', '500 58px "DM Mono"', '600 28px "Manrope"', '500 26px "Manrope"']);

  if (missing.length) {
    await browser.close();
    throw new Error(
      `Carton : police(s) de la marque non chargée(s) — ${missing.join(', ')}. ` +
        'Rendu refusé plutôt que livré dans une police de substitution.',
    );
  }

  await page.screenshot({ path: png });
  await browser.close();
}

function card(png, target) {
  ffmpeg([
    '-loop', '1', '-t', String(CARD_SECONDS), '-i', png,
    '-f', 'lavfi', '-t', String(CARD_SECONDS), '-i', `anullsrc=r=${RATE}:cl=stereo`,
    '-vf', `scale=${W}:${H},fps=${FPS},setsar=1,fade=t=in:st=0:d=0.25`,
    '-shortest', ...VIDEO_OUT, ...AUDIO_OUT, target,
  ]);
}

async function main() {
  const manifestPath = `${OUT}/manifeste.json`;
  if (!existsSync(manifestPath)) throw new Error(`Manifeste introuvable : ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const missing = EDIT.filter((shot) => !manifest.shots[shot.id]).map((shot) => shot.id);
  if (missing.length && !PREVIEW) {
    throw new Error(
      `Plan(s) manquant(s) : ${missing.join(', ')}. Le film complet n’est pas monté — ` +
        'utilisez --apercu pour assembler ce qui existe sous un autre nom.',
    );
  }

  for (const shot of EDIT) {
    if (shot.insert && !existsSync(`${CAPTURES}/${shot.insert}`)) {
      throw new Error(
        `Capture manquante : ${CAPTURES}/${shot.insert}. ` +
          'Lancez d’abord « node scripts/capture-pub.mjs ».',
      );
    }
  }

  mkdirSync(`${OUT}/plans`, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  const segments = [];
  for (const shot of EDIT) {
    const url = manifest.shots[shot.id];
    if (!url) {
      console.log(`Plan ${shot.id} : absent, sauté (aperçu).`);
      continue;
    }
    const source = `${OUT}/plans/${shot.id}.mp4`;
    await download(url, source);

    const target = `${WORK}/${String(shot.id).padStart(2, '0')}.mp4`;
    if (shot.insert) withInsert(source, `${CAPTURES}/${shot.insert}`, shot.at, target);
    else plain(source, target);
    segments.push(target);
    console.log(`Plan ${shot.id} : monté${shot.insert ? ` avec ${shot.insert}` : ''}.`);
  }

  await renderCard(`${WORK}/carton.png`);
  card(`${WORK}/carton.png`, `${WORK}/99-carton.mp4`);
  segments.push(`${WORK}/99-carton.mp4`);
  console.log('Carton : monté.');

  const list = `${WORK}/liste.txt`;
  writeFileSync(list, segments.map((file) => `file '${file.split('/').pop()}'`).join('\n') + '\n');

  const resolution = manifest.resolution ?? 'inconnue';
  const name = PREVIEW && missing.length
    ? `${OUT}/APERCU-incomplet-${resolution}.mp4`
    : `${OUT}/publicite-${resolution}.mp4`;

  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', name]);
  console.log(`\n${name} — ${duration(name).toFixed(2)} s`);
  if (missing.length) console.log(`Plans absents de cet aperçu : ${missing.join(', ')}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
