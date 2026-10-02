/**
 * Sonde de l'impression du ticket.
 *
 * On ne regarde pas « est-ce que ça bouge » — une capture au hasard pendant
 * une animation ne prouve rien. On fige le temps : `document.getAnimations()`
 * donne la main sur chaque animation en cours, et `currentTime` permet de se
 * placer exactement à 300 ms, 700 ms, etc. La séquence est donc échantillonnée
 * de façon reproductible.
 *
 * Contrôle positif inclus : à t = 0 le papier doit être INVISIBLE (hauteur
 * découpée nulle). Si la sonde voyait déjà le ticket entier à t = 0, c'est
 * qu'aucune animation ne tourne et que tous les « verts » suivants ne valent
 * rien.
 */
import pw from 'playwright-core';

const { chromium } = pw;
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT_DIR ?? new URL('./print/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'restaurant', url: 'http://localhost:3000/restaurant' },
  { name: 'boutique', url: 'http://localhost:3000/boutique' },
];
const STEPS = [0, 300, 700, 1100, 1600];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const findings = [];

for (const viewport of VIEWPORTS) {
  for (const target of PAGES) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(target.url, { waitUntil: 'load' });

    // Fige toutes les animations : elles ne consommeront plus de temps réel.
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.pause();
    });

    const ticket = page.locator('.ticket-print').first();
    if ((await ticket.count()) === 0) {
      findings.push(`${target.name}/${viewport.name} : AUCUN .ticket-print sur la page`);
      await context.close();
      continue;
    }

    for (const t of STEPS) {
      await page.evaluate((time) => {
        for (const animation of document.getAnimations()) animation.currentTime = time;
      }, t);

      // Hauteur réellement peinte : le découpage, lu sur l'élément.
      const measured = await ticket.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        // `clip-path: inset(0px 0px X 0px)` — le 3e nombre est le découpage
        // par le bas, et il peut être exprimé en pourcentage AUSSI BIEN qu'en
        // pixels. Ne chercher que des `px` revenait à lire 0 pendant toute la
        // course, donc à ne jamais rien détecter.
        const parts = style.clipPath.match(/-?[\d.]+(?:px|%)/g);
        const raw = parts && parts.length >= 3 ? parts[2] : '0px';
        const cut = raw.endsWith('%')
          ? (parseFloat(raw) / 100) * box.height
          : parseFloat(raw);
        const painted = box.height - cut;

        // Le critère qui compte vraiment : une ligne encrée doit se trouver
        // SUR du papier déjà sorti. Deux fautes possibles, et elles se voient
        // toutes les deux à l'œil :
        //   - « avance » : l'encre apparaît dans le vide, sous le bord ;
        //   - « retard » : le papier est sorti depuis longtemps et reste nu.
        // Chaque bloc de texte du ticket, et sa position sur le papier.
        const blocks = [...element.querySelectorAll('p, .flex')].map(
          (node) => node.getBoundingClientRect().bottom - box.top,
        );
        const revealed = blocks.filter((bottom) => bottom <= painted + 1).length;

        return {
          height: Math.round(box.height),
          painted: Math.round(painted),
          clipPath: style.clipPath,
          revealed,
          blocks: blocks.length,
        };
      });

      findings.push(
        `${target.name}/${viewport.name} t=${String(t).padStart(4)}ms  ` +
          `papier ${String(measured.painted).padStart(3)}/${measured.height}px  ` +
          `lignes sorties ${measured.revealed}/${measured.blocks}`,
      );

      await page
        .locator('section')
        .first()
        .screenshot({ path: `${OUT}${target.name}-${viewport.name}-${t}.png` });
    }

    await context.close();
  }
}

// Mouvement réduit : rien ne doit être caché, à aucun instant.
for (const target of PAGES) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(target.url, { waitUntil: 'load' });
  const state = await page.locator('.ticket-print').first().evaluate((element) => {
    const box = element.getBoundingClientRect();
    const blocks = [...element.querySelectorAll('p, .flex')];
    return {
      clipPath: getComputedStyle(element).clipPath,
      hidden: blocks.filter((node) => {
        const style = getComputedStyle(node);
        return parseFloat(style.opacity) < 0.99 || style.visibility === 'hidden';
      }).length,
      total: blocks.length,
      height: Math.round(box.height),
      animations: document.getAnimations().length,
    };
  });
  findings.push(
    `${target.name}/reduced  clip=${state.clipPath}  hauteur=${state.height}px  ` +
      `blocs masqués ${state.hidden}/${state.total}  animations en cours=${state.animations}`,
  );
  await page
    .locator('section')
    .first()
    .screenshot({ path: `${OUT}${target.name}-reduced.png` });
  await context.close();
}

await browser.close();
console.log(findings.join('\n'));
