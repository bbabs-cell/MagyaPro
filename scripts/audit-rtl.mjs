#!/usr/bin/env node
/**
 * Sonde RTL — les sept gabarits de vitrine, en arabe.
 *
 * L'arabe se lit de droite à gauche. Une mise en page conçue en français peut
 * se retourner correctement sans qu'on y pense — les propriétés logiques
 * (`ms-`, `text-start`) le font seules — ou se retourner à moitié, ce qui est
 * pire qu'un texte en français : les repères de l'écran disent le contraire du
 * texte.
 *
 * Cette sonde n'a pas d'opinion sur le goût. Elle mesure trois choses qu'un
 * œil ne peut pas relever de façon fiable sur sept gabarits, deux largeurs et
 * une langue qu'il ne lit pas :
 *
 * 1. **Le sens de lecture est-il réellement appliqué** — `dir="rtl"` posé, et
 *    la direction calculée sur le texte du corps.
 * 2. **Débordement horizontal** — une mise en page qui tient en français peut
 *    déborder une fois retournée.
 * 3. **Éléments ancrés physiquement** — positionnés à `left` ou `right` en
 *    dur. Ils ne se retournent pas, et ce sont eux qui produisent une flèche
 *    « précédent » du côté de « suivant ».
 *
 * ## Calibrage
 *
 * Une sonde qui n'atteint rien affiche « aucun problème ». Elle vérifie donc
 * d'abord qu'elle a bien chargé une vitrine en arabe : si le gabarit demandé
 * n'est pas celui rendu, ou si la page revient en français, elle s'arrête au
 * lieu de rendre un rapport vert et faux.
 */

import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  (process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined);
const SLUG = process.env.SLUG ?? 'demo-la-terrasse';
const WIDTHS = (process.env.WIDTHS ?? '375,1280').split(',').map(Number);

const TEMPLATES = [
  'modern',
  'african-premium',
  'fast-food',
  'traditional',
  'elegant',
  'street-food',
  'prestige',
];

/** Chemins visités par gabarit : l'accueil, la carte, et la galerie. */
const PATHS = ['', '/menu'];

function psql(sql) {
  const url = (process.env.DATABASE_URL ?? '').split('?')[0];
  if (!url) throw new Error('DATABASE_URL absent — impossible de changer de gabarit.');
  return execFileSync('psql', [url, '-t', '-A', '-c', sql], { encoding: 'utf8' }).trim();
}

/** Mesures faites dans la page, une fois rendue. */
function inspect() {
  const root = document.querySelector('[data-template]') ?? document.body;

  const overflows = [];
  const physical = [];

  for (const element of document.querySelectorAll('body *')) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    const box = element.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;

    // Débordement : la boîte sort de la fenêtre par la droite ou la gauche.
    // Les éléments volontairement décentrés (décor flou, hors flux) sont
    // écartés : ils ne portent aucun contenu.
    const decorative =
      element.getAttribute('aria-hidden') === 'true' ||
      (element.textContent ?? '').trim() === '';
    if (!decorative && (box.right > window.innerWidth + 1 || box.left < -1)) {
      overflows.push({
        tag: element.tagName.toLowerCase(),
        cls: (element.className ?? '').toString().slice(0, 70),
        left: Math.round(box.left),
        right: Math.round(box.right),
        text: (element.textContent ?? '').trim().slice(0, 40),
      });
    }

    /**
     * Ancrage physique : un élément **collé à un seul côté**, et ce côté est
     * nommé en dur.
     *
     * Le premier jet signalait tout élément positionné dont `left` ou `right`
     * était renseigné. Il rendait 196 lignes sur sept gabarits, dont presque
     * aucune n'était un défaut : `left: 0` **et** `right: 0` — c'est-à-dire
     * `inset-x-0` — est symétrique, donc juste dans les deux sens de lecture.
     * Une sonde qui noie quatre défauts dans 196 lignes ne se lit plus, et
     * c'est une façon de ne rien signaler du tout.
     *
     * Ne reste donc que l'asymétrie : un côté fixé, l'autre libre. C'est elle,
     * et elle seule, qui produit une flèche « précédent » du côté de
     * « suivant » quand la page se retourne.
     */
    if (style.position === 'absolute' || style.position === 'fixed') {
      /**
       * Le côté ancré se lit dans les **classes**, pas dans le style calculé.
       *
       * Deux versions de ce contrôle ont rendu un vert imméritable avant que
       * je comprenne pourquoi. `getComputedStyle` ne rend pas la valeur
       * *déclarée* mais la valeur *utilisée* : sur un élément positionné,
       * Chrome résout `left` en pixels même lorsque la feuille de style dit
       * `auto`. Les deux côtés paraissent donc toujours fixés, et un critère
       * fondé sur l'asymétrie ne peut, par construction, rien détecter.
       *
       * C'est le pire mode de défaillance possible pour une sonde : elle ne
       * plante pas, elle félicite.
       *
       * L'intention, elle, est écrite en toutes lettres dans l'attribut de
       * classe. `right-4` ne se retourne pas en lecture arabe ; `end-4`, si.
       * `left-1/2` désigne le milieu et ne change pas de côté.
       */
      const classes = (element.className ?? '').toString();
      const anchored = classes.match(/(?:^|\s)-?(?:left|right)-(?!1\/2\b)[\w./[\]-]+/g) ?? [];
      const offscreen = box.width <= 1 || box.height <= 1;
      const interactive = element.tagName === 'BUTTON' || element.tagName === 'A';

      if (anchored.length && interactive && !offscreen && element.getAttribute('aria-hidden') !== 'true') {
        physical.push({
          tag: element.tagName.toLowerCase(),
          label: element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 30),
          sides: anchored.map((klass) => klass.trim()).join(' '),
        });
      }
    }
  }

  return {
    // Calibrage.
    template: root.getAttribute('data-template'),
    dir: root.getAttribute('dir') ?? getComputedStyle(root).direction,
    bodyDirection: getComputedStyle(document.body).direction,
    htmlLang: document.documentElement.lang,
    // Un texte arabe doit être présent : sinon la page est revenue au français
    // et toute mesure de retournement est sans objet.
    hasArabic: /[؀-ۿ]/.test(document.body.innerText),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflows: overflows.slice(0, 10),
    physical: physical.slice(0, 10),
  };
}

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const findings = [];
let measured = 0;
let calibrationFailures = 0;
let openedGalleries = 0;

const before = psql(`SELECT "templateKey" FROM restaurants WHERE slug = '${SLUG}';`);
if (!before) throw new Error(`Aucun restaurant « ${SLUG} » — la sonde ne mesurerait rien.`);

try {
  for (const template of TEMPLATES) {
    psql(`UPDATE restaurants SET "templateKey" = '${template}' WHERE slug = '${SLUG}';`);

    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();

      for (const path of PATHS) {
        const url = `${BASE}/r/${SLUG}${path}?lang=ar`;
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        if (!response?.ok()) {
          calibrationFailures++;
          findings.push({ template, width, path, kind: 'chargement', detail: `HTTP ${response?.status()}` });
          continue;
        }

        /**
         * La galerie photo s'ouvre en pop-up, et ses commandes — fermer,
         * précédent, suivant — n'existent dans le document qu'une fois
         * ouverte. Une sonde qui se contente de la page au repos ne les voit
         * jamais, et c'est précisément là que se joue le sens de lecture.
         */
        const galleryPhoto = page.locator('button:has(img)').first();
        let galleryOpened = false;
        if (await galleryPhoto.count()) {
          await galleryPhoto.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(150);
          galleryOpened = await page.locator('[role="dialog"]').count() > 0;
        }
        if (galleryOpened) openedGalleries++;

        const seen = await page.evaluate(inspect);

        // Calibrage, avant toute interprétation.
        if (seen.template !== template) {
          calibrationFailures++;
          findings.push({
            template,
            width,
            path,
            kind: 'calibrage',
            detail: `gabarit rendu « ${seen.template} » au lieu de « ${template} »`,
          });
          continue;
        }
        if (!seen.hasArabic) {
          calibrationFailures++;
          findings.push({ template, width, path, kind: 'calibrage', detail: 'aucun texte arabe dans la page' });
          continue;
        }

        measured++;

        if (seen.dir !== 'rtl' || seen.bodyDirection !== 'rtl') {
          findings.push({
            template,
            width,
            path,
            kind: 'direction',
            detail: `dir=${seen.dir}, direction calculée=${seen.bodyDirection}`,
          });
        }
        if (seen.htmlLang !== 'ar') {
          findings.push({ template, width, path, kind: 'lang', detail: `<html lang="${seen.htmlLang}">` });
        }
        if (seen.scrollWidth > seen.clientWidth + 1) {
          findings.push({
            template,
            width,
            path,
            kind: 'débordement',
            detail: `${seen.scrollWidth}px de contenu pour ${seen.clientWidth}px de fenêtre`,
            elements: seen.overflows,
          });
        }
        for (const item of seen.physical) {
          findings.push({
            template,
            width,
            path,
            kind: 'ancrage physique',
            detail: `${item.tag} « ${item.label} » — ${item.sides}`,
          });
        }
      }

      await context.close();
    }
  }
} finally {
  psql(`UPDATE restaurants SET "templateKey" = '${before}' WHERE slug = '${SLUG}';`);
  await browser.close();
}

const combinations = TEMPLATES.length * WIDTHS.length * PATHS.length;
console.log(`\nRTL — ${measured}/${combinations} pages réellement mesurées.`);
if (calibrationFailures) {
  console.log(`⚠ ${calibrationFailures} page(s) non mesurée(s) : le résultat ci-dessous ne les couvre pas.`);
}
// La galerie porte les seules commandes directionnelles du produit
// (précédent / suivant / fermer). Si elle ne s'est jamais ouverte, le
// rapport est muet là où il compte le plus — et il doit le dire.
console.log(
  openedGalleries
    ? `Galerie ouverte sur ${openedGalleries} page(s) : ses commandes sont couvertes.`
    : '⚠ Galerie jamais ouverte — aucune commande directionnelle mesurée. Ce rapport ne dit RIEN de la pop-up photo.',
);

if (!findings.length) {
  console.log(measured === 0 ? '✗ Rien mesuré — ce rapport ne prouve rien.' : '✓ Aucun défaut relevé.');
} else {
  const byKind = new Map();
  for (const finding of findings) {
    byKind.set(finding.kind, [...(byKind.get(finding.kind) ?? []), finding]);
  }
  for (const [kind, list] of byKind) {
    console.log(`\n■ ${kind} — ${list.length}`);
    const seen = new Set();
    for (const finding of list) {
      const line = `  ${finding.template} @${finding.width}${finding.path || '/'} — ${finding.detail}`;
      if (seen.has(line)) continue;
      seen.add(line);
      console.log(line);
      for (const element of finding.elements ?? []) {
        console.log(`      ${element.tag}.${element.cls} [${element.left}→${element.right}] « ${element.text} »`);
      }
    }
  }
}

process.exitCode = findings.some((f) => f.kind !== 'ancrage physique') ? 1 : 0;
