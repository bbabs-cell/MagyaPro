#!/usr/bin/env node
/**
 * Sonde des couleurs — les fonds et les textes sont-ils réellement peints ?
 *
 * Cette sonde existe à cause d'une panne que j'ai moi-même provoquée. Les
 * couleurs du thème sont passées par une fonction, pour rendre utilisables les
 * modificateurs d'opacité (`bg-ink/25`). Cette fonction produisait `NaN%` dans
 * le cas **sans** modificateur — donc une déclaration invalide, donc aucun fond
 * et aucune couleur de texte sur l'ensemble du produit.
 *
 * Rien ne l'a signalé : le CSS se compilait, `tsc` et `eslint` passaient, les
 * 351 tests restaient verts, et j'avais vérifié le CSS produit — mais
 * seulement pour les classes **avec** modificateur. Un contrôle qui ne regarde
 * qu'un des deux cas laisse passer l'autre entièrement.
 *
 * Le seul juge est donc le navigateur : une couleur déclarée mais invalide est
 * indistinguable d'une couleur absente, sauf en demandant à la page ce qu'elle
 * peint vraiment.
 *
 * ## Ce qui est mesuré
 *
 * Sur chaque page, pour chaque élément visible portant une classe de couleur
 * du thème : la couleur calculée est-elle opaque et effective ? Deux échecs
 * distincts sont cherchés, parce qu'ils ne se ressemblent pas à l'écran :
 *
 * - `transparent` / `rgba(0, 0, 0, 0)` là où une couleur est demandée : la
 *   déclaration a été jetée ;
 * - un contraste texte/fond effondré : les deux couleurs sont peintes, mais le
 *   texte devient illisible.
 */

import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  (process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined);

/** Pages publiques : aucune session requise, donc aucun secret dans la sonde. */
const PAGES = ['/', '/restaurant', '/connexion', '/boutique/connexion', '/r/demo-la-terrasse'];

/** Classes de couleur du thème qui doivent produire une peinture visible. */
const PAINTED = [
  'bg-surface',
  'bg-surface-raised',
  'bg-surface-sunken',
  'bg-ink',
  'bg-brand',
  'bg-nav',
  'bg-state-warn-soft',
  'bg-state-bad-soft',
  'bg-state-ok-soft',
];

function probe(painted) {
  const results = { transparent: [], painted: 0, bodyBackground: '', bodyColor: '' };

  /**
   * Une couleur est-elle réellement peinte ?
   *
   * Premier jet : `/,\s*0\)$/`. Il déclarait `rgb(0, 0, 0)` — du noir franc —
   * invisible, parce que la chaîne finit bien par « 0) ». La sonde signalait
   * donc des défauts inexistants sur la vitrine, ce qui use la confiance
   * qu'on lui accorde aussi sûrement qu'un silence indu.
   *
   * L'alpha ne se lit pas dans la fin d'une chaîne : il n'existe que dans la
   * forme à quatre composantes.
   */
  const isPainted = (value) => {
    if (!value || value === 'transparent') return false;
    const parts = value.match(/[\d.]+/g);
    if (!parts) return false;
    return parts.length < 4 || Number(parts[3]) > 0;
  };

  const body = getComputedStyle(document.body);
  results.bodyBackground = body.backgroundColor;
  results.bodyColor = body.color;

  for (const className of painted) {
    for (const element of document.querySelectorAll(`.${CSS.escape(className)}`)) {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      const background = style.backgroundColor;
      if (!isPainted(background)) {
        results.transparent.push({ className, background, tag: element.tagName.toLowerCase() });
      } else {
        results.painted++;
      }
    }
  }

  // Le texte du corps : une couleur jetée y est la plus visible de toutes.
  const texts = [];
  for (const element of document.querySelectorAll('h1, h2, p, a, button, span')) {
    const style = getComputedStyle(element);
    if (!isPainted(style.color)) {
      texts.push({ tag: element.tagName.toLowerCase(), color: style.color });
    }
  }
  results.transparentText = texts.slice(0, 5);
  results.bodyPainted = isPainted(body.backgroundColor);

  return results;
}

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

let measured = 0;
let failures = 0;

for (const path of PAGES) {
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  if (!response?.ok()) {
    console.log(`⚠ ${path} — HTTP ${response?.status()}, non mesurée.`);
    continue;
  }

  const seen = await page.evaluate(probe, PAINTED);

  // Calibrage : une page sans un seul élément coloré ne prouve rien, et
  // afficherait « aucun problème ».
  if (seen.painted === 0 && seen.transparent.length === 0) {
    console.log(`⚠ ${path} — aucune classe de couleur du thème trouvée : rien mesuré ici.`);
    continue;
  }

  measured++;
  const bodyPainted = seen.bodyPainted;

  const problems = [];
  if (!bodyPainted) problems.push(`fond du corps non peint (${seen.bodyBackground})`);
  for (const item of seen.transparent) {
    problems.push(`${item.tag}.${item.className} → ${item.background}`);
  }
  for (const item of seen.transparentText ?? []) {
    problems.push(`texte ${item.tag} → ${item.color}`);
  }

  if (problems.length) {
    failures++;
    console.log(`\n✗ ${path}`);
    for (const problem of problems.slice(0, 8)) console.log(`   ${problem}`);
  } else {
    console.log(`✓ ${path} — corps ${seen.bodyBackground} / ${seen.bodyColor}, ${seen.painted} éléments peints.`);
  }
}

await browser.close();

console.log(`\n${measured}/${PAGES.length} pages réellement mesurées.`);
if (measured === 0) {
  console.log('✗ Rien mesuré — ce rapport ne prouve rien.');
  process.exitCode = 1;
} else {
  process.exitCode = failures ? 1 : 0;
}
