/**
 * Rendu d'un tutoriel vidéo MagyaPro, voix comprise.
 *
 * 1. **La voix** : chaque phrase du script (`<tuto>.json`) est dite par Piper,
 *    une synthèse vocale libre (MIT) qui tourne sur la machine — aucun
 *    service payant, aucun envoi du texte ailleurs. Chaque phrase est mise en
 *    cache d'après son texte et sa voix : changer une phrase ne refait
 *    qu'elle.
 * 2. **Le minutage** : la durée de chaque phrase est mesurée, puis transmise à
 *    la scène (`configure`) : chaque geste tombe pendant la phrase qui
 *    l'annonce, quelle que soit la voix choisie.
 * 3. **L'image** : la scène est photographiée image par image (même principe
 *    que `scripts/motion/render.mjs`), puis la voix est posée sur la piste,
 *    chaque phrase à son instant.
 *
 * ## Emploi
 *
 *   npm run build                       # les polices du site
 *   PIPER=/chemin/piper PIPER_VOICES=/chemin/voix \
 *     node scripts/tutos/render-tuto.mjs comptoir [--format vertical] [--voix siwis]
 *   … --voix-dir publicite/tutos/voix-eleven
 *                                       # voix enregistrées (<id>.mp3), Piper en secours
 *   … --essai 3,9,15                    # quelques images fixes, sans vidéo
 *
 * Piper : `pip install piper-tts` (dans un environnement à part), voix
 * françaises sur huggingface.co/rhasspy/piper-voices (fr_FR-siwis-medium,
 * fr_FR-tom-medium, fr_FR-upmc-medium). Ce sont des outils de production,
 * jamais des dépendances de l'application.
 *
 * Sortie : publicite/tutos/<tuto>[-vertical].mp4 (H.264 + AAC).
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import pw from 'playwright-core';

const { chromium } = pw;
const FPS = 30;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const TUTO = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'comptoir';
const VERTICAL = arg('format') === 'vertical';
const VOICE = arg('voix', 'siwis');
/**
 * Voix enregistrées ailleurs (ElevenLabs, ou une vraie voix) : un fichier
 * `<id>.mp3` par phrase dans ce dossier. Une phrase absente est dite par
 * Piper, en secours — signalé à chaque rendu.
 */
const VOICE_DIR = arg('voix-dir');
const W = VERTICAL ? 1080 : 1920;
const H = VERTICAL ? 1920 : 1080;
const OUT = resolve(process.env.OUT_DIR ?? 'publicite/tutos');
const PIPER = process.env.PIPER ?? 'piper';
const VOICES = process.env.PIPER_VOICES ?? '.';
const script = JSON.parse(readFileSync(`scripts/tutos/${TUTO}.json`, 'utf8'));

const probe = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

/** Fait dire chaque phrase, avec cache. Rend [{ ...segment, fichier, duree }]. */
function speak() {
  const dir = `${OUT}/voix`;
  mkdirSync(dir, { recursive: true });
  const model = resolve(VOICES, `fr_FR-${VOICE}-medium.onnx`);
  return script.segments.map((segment) => {
    const recorded = VOICE_DIR ? resolve(VOICE_DIR, `${segment.id}.mp3`) : null;
    if (recorded && existsSync(recorded)) return { ...segment, fichier: recorded, duree: probe(recorded), source: 'enregistrée' };
    if (VOICE_DIR) console.warn(`  ⚠ ${segment.id} : pas de voix enregistrée, Piper (${VOICE}) en secours`);
    const hash = createHash('sha1').update(`${VOICE}|${segment.texte}`).digest('hex').slice(0, 12);
    const file = `${dir}/${TUTO}-${segment.id}-${hash}.wav`;
    if (!existsSync(file)) {
      if (!existsSync(model)) throw new Error(`Voix introuvable : ${model}`);
      execFileSync(PIPER, ['-m', model, '-f', file, '--sentence_silence', '0.25'], { input: segment.texte });
    }
    return { ...segment, fichier: file, duree: probe(file), source: 'piper' };
  });
}

/**
 * Les bruitages, fabriqués par ffmpeg à partir de sons purs et de bruit :
 * aucun échantillon tiers, donc rien à créditer ni à licencier.
 */
const SOUNDS = {
  clic: { src: "aevalsrc='0.7*sin(2*PI*2600*t)*exp(-70*t)+0.4*sin(2*PI*1300*t)*exp(-90*t)':d=0.09", volume: 0.35 },
  coche: { src: "aevalsrc='0.5*sin(2*PI*1320*t)*exp(-22*t)+0.25*sin(2*PI*1980*t)*exp(-30*t)':d=0.3", volume: 0.4 },
  carillon: { src: "aevalsrc='0.45*sin(2*PI*880*t)*exp(-5*t)+0.45*sin(2*PI*1318.5*(t-0.13))*exp(-5*(t-0.13))*gte(t,0.13)':d=1.3", volume: 0.5 },
  souffle: { src: 'anoisesrc=d=0.7:c=pink:a=0.6,highpass=f=500,lowpass=f=4000,afade=t=in:d=0.35,afade=t=out:st=0.35:d=0.35', volume: 0.22 },
  froisse: { src: 'anoisesrc=d=0.55:c=white:a=0.5,bandpass=f=3200:w=2500,tremolo=f=28:d=0.95,afade=t=out:st=0.25:d=0.3', volume: 0.35 },
};
function soundFiles() {
  const dir = `${OUT}/sons`;
  mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [name, { src }] of Object.entries(SOUNDS)) {
    const file = `${dir}/${name}.wav`;
    if (!existsSync(file)) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', src, '-ar', '48000', '-ac', '1', file]);
    files[name] = file;
  }
  return files;
}

const BRAND_FAMILIES = ['Bricolage Grotesque', 'Manrope', 'DM Mono'];
/** Les polices du site, relues dans son build (voir `scripts/motion/render.mjs`). */
function brandFontFaces() {
  const dir = '.next/static/css';
  if (!existsSync(dir)) throw new Error('Build introuvable : lancez « npm run build ».');
  const media = `file://${resolve('.next/static/media')}/`;
  return readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .flatMap((file) => readFileSync(`${dir}/${file}`, 'utf8').match(/@font-face\{[^}]*\}/g) ?? [])
    .filter((face) => BRAND_FAMILIES.some((family) => face.includes(`font-family:${family};`)))
    .map((face) => face.replaceAll('url(/_next/static/media/', `url(${media}`))
    .join('\n');
}

async function openScene(browser, segments) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`file://${resolve('scripts/tutos/tuto.html')}?tuto=${TUTO}${VERTICAL ? '&format=vertical' : ''}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: brandFontFaces() });
  const missing = await page.evaluate(async (specs) => {
    const out = [];
    for (const spec of specs) if ((await document.fonts.load(spec)).length === 0) out.push(spec);
    return out;
  }, ['800 70px "Bricolage Grotesque"', '600 15px "Manrope"', '500 20px "DM Mono"']);
  if (missing.length) throw new Error(`Police(s) non chargée(s) : ${missing.join(', ')}`);
  await page.evaluate((segs) => window.configure(segs), segments.map(({ id, etape, titre, texte, geste, duree }) => ({ id, etape, titre, texte, geste, duree })));
  return page;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const segments = speak();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await openScene(browser, segments);
    const duration = await page.evaluate(() => window.DURATION);
    const starts = await page.evaluate(() => SEG.map((s) => s.start));
    const cueList = await page.evaluate(() => window.CUES ?? []);

    const essai = arg('essai');
    if (essai) {
      for (const t of essai.split(',').map(Number)) {
        // L'état « apparu depuis » des éléments dépend du passé : on rejoue
        // les images précédentes, vite, pour que l'aperçu soit exact.
        for (let x = Math.max(0, t - 1.2); x < t; x += 0.1) await page.evaluate((v) => window.render(v), x);
        await page.evaluate((v) => window.render(v), t);
        const path = `${OUT}/essai-${TUTO}${VERTICAL ? '-v' : ''}-${String(t).replace('.', '_')}s.png`;
        await page.screenshot({ path });
        console.log(`  ✓ ${path}`);
      }
      return;
    }

    const name = `${TUTO}${VERTICAL ? '-vertical' : ''}`;
    const silent = `${OUT}/${name}-image.mp4`;
    const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((ok, fail) => ffmpeg.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg ${code}`)))));
    const total = Math.round(duration * FPS);
    for (let i = 0; i < total; i += 1) {
      await page.evaluate((v) => window.render(v), i / FPS);
      const png = await page.screenshot({ type: 'png' });
      if (!ffmpeg.stdin.write(png)) await new Promise((ok) => ffmpeg.stdin.once('drain', ok));
      if (i % FPS === 0) process.stdout.write(`\r  ${Math.round((i / total) * 100)} %`);
    }
    ffmpeg.stdin.end();
    await done;
    process.stdout.write('\r  100 %\n');

    // La piste son : chaque phrase à son instant, et les bruitages sous la voix.
    const sounds = soundFiles();
    const tracks = [
      ...segments.map((s, i) => ({ file: s.fichier, t: starts[i], volume: 1 })),
      ...cueList.filter((c) => sounds[c.type]).map((c) => ({ file: sounds[c.type], t: Math.max(0, c.t), volume: SOUNDS[c.type].volume })),
    ];
    const inputs = tracks.flatMap((track) => ['-i', track.file]);
    const chains = tracks.map((track, i) => `[${i + 1}:a]aresample=48000,volume=${track.volume},adelay=${Math.round(track.t * 1000)}:all=1[a${i}]`).join(';');
    const mixIn = tracks.map((_, i) => `[a${i}]`).join('');
    const final = `${OUT}/${name}.mp4`;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', silent, ...inputs,
      '-filter_complex', `${chains};${mixIn}amix=inputs=${tracks.length}:normalize=0,alimiter=limit=0.95,apad[son]`,
      '-map', '0:v', '-map', '[son]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    const fallback = segments.filter((s) => s.source === 'piper').map((s) => s.id);
    if (VOICE_DIR && fallback.length) console.warn(`  ⚠ voix de secours (Piper) pour : ${fallback.join(', ')}`);
    console.log(`  ${final} — ${duration.toFixed(1)} s, ${(statSync(final).size / 1024 / 1024).toFixed(1)} Mo`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
