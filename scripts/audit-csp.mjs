#!/usr/bin/env node
/**
 * Sonde CSP — la politique protège-t-elle sans rien casser ?
 *
 * `script-src` autorisait `unsafe-inline`, c'est-à-dire que **tout `<script>`
 * injecté dans une page s'exécutait**. C'est la faille qui vide une CSP de son
 * intérêt principal. Elle est remplacée par un nonce : un jeton tiré au sort
 * pour chaque réponse, qu'un script injecté ne peut pas deviner.
 *
 * Un durcissement de ce genre ne se relit pas, il se mesure — et son mode de
 * défaillance est brutal : si le nonce n'atteint pas les scripts de Next, la
 * page s'affiche mais **ne s'anime plus**. Aucune erreur serveur, aucun test
 * rouge, rien qu'un écran inerte. C'est exactement ce qui justifie cette sonde.
 *
 * ## Ce qui est mesuré, sur chaque page
 *
 * 1. **Aucune violation** : le navigateur émet `securitypolicyviolation` pour
 *    chaque ressource refusée. Zéro attendu.
 * 2. **`unsafe-inline` a bien disparu** de `script-src`, et un nonce est
 *    présent — sans quoi le reste ne prouverait rien.
 * 3. **Le nonce change à chaque réponse.** Un nonce constant serait aussi
 *    permissif qu'`unsafe-inline`, en moins lisible.
 * 4. **L'hydratation fonctionne** : React a bien pris la main sur le HTML.
 *    C'est le symptôme n°1 d'un nonce mal propagé.
 * 5. **Un script inline sans nonce est bien refusé** — le contrôle positif.
 *    Sans lui, une sonde qui ne voit aucune violation ne prouve rien du tout.
 */

import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  (process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined);

const PAGES = [
  '/',
  '/restaurant',
  '/connexion',
  '/inscription',
  '/boutique/connexion',
  '/r/demo-la-terrasse',
  '/r/demo-la-terrasse/menu',
];

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox'],
});

let measured = 0;
let failures = 0;
const nonces = [];

for (const path of PAGES) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const violations = [];
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push({
        directive: event.violatedDirective,
        blocked: String(event.blockedURI).slice(0, 80),
      });
    });
  });

  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  if (!response?.ok()) {
    console.log(`⚠ ${path} — HTTP ${response?.status()}, non mesurée.`);
    await context.close();
    continue;
  }

  const header = response.headers()['content-security-policy'] ?? '';
  const scriptSrc = header.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';
  const nonce = scriptSrc.match(/'nonce-([^']+)'/)?.[1] ?? null;

  const problems = [];
  if (!header) problems.push('aucun en-tête Content-Security-Policy');
  if (!nonce) problems.push('aucun nonce dans script-src');
  if (scriptSrc.includes('unsafe-inline')) problems.push("script-src autorise encore 'unsafe-inline'");
  if (nonce) nonces.push(nonce);

  /**
   * Le HTML doit réellement porter le nonce : c'est ce qui distingue une
   * politique appliquée d'une politique seulement annoncée.
   *
   * Il faut lire le corps **tel que servi**, pas `page.content()`. Les
   * navigateurs effacent l'attribut `nonce` du DOM sitôt appliqué — une
   * protection contre son extraction par sélecteur CSS. Mesuré sur le DOM,
   * ce contrôle échoue donc toujours, y compris quand tout fonctionne : il
   * signalait un défaut sur les sept pages alors que l'hydratation était
   * vivante et que le contrôle positif passait.
   */
  const servedHtml = await response.text();
  if (nonce && !servedHtml.includes(`nonce="${nonce}"`)) {
    problems.push('aucune balise <script> servie ne porte le nonce de cette réponse');
  }

  // Hydratation : React a-t-il pris la main ? Un nonce mal propagé donne une
  // page qui s'affiche et ne répond plus.
  const hydrated = await page.evaluate(() => {
    const root = document.querySelector('body > div, #__next, main');
    if (!root) return false;
    // React 18/19 attache ses conteneurs de racine sur le nœud hôte.
    const keys = Object.keys(root).concat(Object.keys(document.body));
    return keys.some((key) => key.startsWith('__react') || key.startsWith('_reactListening'));
  });
  if (!hydrated) problems.push('React ne semble pas avoir hydraté la page');

  violations.push(...(await page.evaluate(() => window.__cspViolations ?? [])));
  for (const violation of violations) {
    problems.push(`bloqué — ${violation.directive} : ${violation.blocked}`);
  }

  // Contrôle positif : un script inline dépourvu de nonce doit être refusé.
  // Sans cette vérification, « aucune violation » pourrait simplement vouloir
  // dire que la politique n'est pas appliquée du tout.
  const injectedRan = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__injected = true;';
    document.body.appendChild(script);
    return window.__injected === true;
  });
  if (injectedRan) {
    problems.push("CONTRÔLE POSITIF ÉCHOUÉ : un script inline sans nonce s'est exécuté");
  }

  measured++;
  if (problems.length) {
    failures++;
    console.log(`\n✗ ${path}`);
    for (const problem of problems.slice(0, 8)) console.log(`   ${problem}`);
  } else {
    console.log(`✓ ${path} — nonce posé, inline non noncé refusé, hydratation vivante.`);
  }

  await context.close();
}

// Un nonce qui ne change pas ne protège de rien.
const unique = new Set(nonces).size;
console.log(`\n${measured}/${PAGES.length} pages réellement mesurées.`);
if (nonces.length) {
  const varying = unique === nonces.length;
  console.log(
    varying
      ? `✓ ${unique} nonces distincts pour ${nonces.length} réponses : le jeton change bien à chaque fois.`
      : `✗ ${unique} nonces distincts pour ${nonces.length} réponses — un jeton réutilisé ne protège de rien.`,
  );
  if (!varying) failures++;
}

await browser.close();

if (measured === 0) {
  console.log('✗ Rien mesuré — ce rapport ne prouve rien.');
  process.exitCode = 1;
} else {
  process.exitCode = failures ? 1 : 0;
}
