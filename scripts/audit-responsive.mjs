import { chromium } from 'playwright-core';

/**
 * Audit responsive — mesure réelle, dans un vrai navigateur.
 *
 * Pourquoi ce script existe : un `grep` ne peut pas dire si une page déborde.
 * Les trois débordements trouvés en phase 18 venaient tous du même piège de
 * flexbox — la largeur plancher d'un élément `flex-1` est celle de son
 * contenu tant qu'on ne pose pas `min-w-0` — et **aucun n'était visible dans
 * le code**. Il a fallu rendre les pages pour les voir.
 *
 * Ce que le script vérifie, à quatre largeurs :
 *  - la page déborde-t-elle horizontalement, et par la faute de quel élément
 *    précis (en ignorant ce qui déborde dans un conteneur prévu pour défiler) ;
 *  - reste-t-il des cibles tactiles sous 24 px, en appliquant les deux
 *    exceptions du critère WCAG 2.5.8 — liens en ligne dans un texte, et
 *    cibles suffisamment espacées.
 *
 * Il n'annonce jamais un succès pour une page qu'il n'a pas pu mesurer.
 *
 * PRÉREQUIS
 *   1. une base PostgreSQL avec des données (`npx prisma db seed`) ;
 *   2. l'application lancée : `npm run build && npm run start` ;
 *      ⚠ redémarrez le serveur après chaque build — un serveur qui survit à
 *      un `build` sert un HTML qui pointe vers des feuilles de style
 *      effacées, et les pages se mesurent alors sans aucun style ;
 *   3. `npm i --no-save playwright-core` (Chromium est déjà présent sur les
 *      images qui définissent `PLAYWRIGHT_BROWSERS_PATH`).
 *
 * USAGE
 *   node scripts/audit-responsive.mjs /une/page /une/autre
 *   node scripts/audit-responsive.mjs /dashboard --login "email:motdepasse"
 *   LOGIN_PATH=/boutique/connexion node scripts/audit-responsive.mjs …
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  (process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined);

const VIEWPORTS = [
  { name: '320 (petit téléphone)', width: 320, height: 700 },
  { name: '375 (iPhone SE/13 mini)', width: 375, height: 780 },
  { name: '414 (grand téléphone)', width: 414, height: 850 },
  { name: '768 (tablette)', width: 768, height: 1024 },
];

const args = process.argv.slice(2);
const loginIndex = args.indexOf('--login');
const credentials = loginIndex === -1 ? null : args[loginIndex + 1];
const PAGES = loginIndex === -1 ? args : args.slice(0, loginIndex);

/** Ouvre une session réelle via le formulaire, comme le ferait un commerçant. */
async function signIn(page) {
  const [email, password] = credentials.split(':');
  await page.goto(BASE + (process.env.LOGIN_PATH || '/connexion'), { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/connexion'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

let skipped = 0;
const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const results = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: viewport.width < 768,
    hasTouch: viewport.width < 768,
  });
  const page = await context.newPage();
  if (credentials) {
    try {
      await signIn(page);
    } catch (error) {
      console.log(`Connexion impossible @ ${viewport.name} : ${String(error).slice(0, 120)}`);
      skipped += PAGES.length;
      await context.close();
      continue;
    }
  }

  for (const path of PAGES) {
    let status = 0;
    try {
      const response = await page.goto(BASE + path, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      status = response?.status() ?? 0;
    } catch (error) {
      results.push({ viewport: viewport.name, path, error: String(error).slice(0, 80) });
      continue;
    }

    const report = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      );

      // Élément(s) fautif(s) : ceux dont le bord droit dépasse la fenêtre.
      const guilty = [];
      if (scrollWidth > docWidth + 1) {
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right <= docWidth + 1 && rect.left >= -1) continue;

          // On ignore ce qui déborde à l'intérieur d'un conteneur qui défile
          // volontairement — c'est le comportement voulu, pas un défaut.
          let scrollableAncestor = false;
          for (let p = el.parentElement; p; p = p.parentElement) {
            const overflowX = getComputedStyle(p).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
              scrollableAncestor = true;
              break;
            }
          }
          if (scrollableAncestor) continue;

          guilty.push({
            tag: el.tagName.toLowerCase(),
            cls: (typeof el.className === 'string' ? el.className : '').slice(0, 90),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            text: (el.textContent ?? '').trim().slice(0, 40),
          });
        }
      }

      // Cibles tactiles trop petites parmi les éléments réellement cliquables.
      //
      // Le critère WCAG 2.5.8 (AA) demande 24×24 px, avec deux exceptions
      // retenues ici : les liens en ligne dans un texte, et les cibles
      // suffisamment espacées pour qu'un disque de 24 px centré sur chacune
      // n'en touche aucune autre. Sans ces exceptions, la sonde signale des
      // liens de navigation parfaitement utilisables et noie le vrai signal.
      const small = [];
      const targets = [...document.querySelectorAll('a[href], button, [role="button"], input, select')]
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter((t) => t.rect.width > 0 && t.rect.height > 0);

      const wellSpaced = (rect) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return !targets.some(({ rect: other }) => {
          if (other === rect) return false;
          const ocx = other.left + other.width / 2;
          const ocy = other.top + other.height / 2;
          if (ocx === cx && ocy === cy) return false;
          return Math.hypot(ocx - cx, ocy - cy) < 24;
        });
      };

      for (const el of document.querySelectorAll('a[href], button, [role="button"], input, select')) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden') continue;
        // WCAG 2.5.8 exempte explicitement les liens en ligne dans un texte :
        // leur taille est celle de la phrase, on ne peut pas l'agrandir sans
        // casser le paragraphe. Ne restent que les commandes autonomes.
        if (style.display === 'inline') continue;
        // Le lien d'évitement est réduit à 1×1 tant qu'il n'a pas le focus.
        if (el.className && String(el.className).includes('sr-only')) continue;
        if ((rect.height < 24 || rect.width < 24) && !wellSpaced(rect)) {
          small.push({
            tag: el.tagName.toLowerCase(),
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            text: (el.textContent ?? '').trim().slice(0, 30),
            cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
          });
        }
      }

      return { docWidth, scrollWidth, guilty: guilty.slice(0, 6), small: small.slice(0, 6) };
    });

    results.push({ viewport: viewport.name, path, status, ...report });
  }

  await context.close();
}

await browser.close();

let problems = 0;
for (const r of results) {
  if (r.error) {
    console.log(`\n✗ ${r.path} @ ${r.viewport} — ${r.error}`);
    problems++;
    continue;
  }
  const overflow = r.scrollWidth - r.docWidth;
  const hasOverflow = overflow > 1 && r.guilty.length > 0;
  const hasSmall = r.small.length > 0;
  if (!hasOverflow && !hasSmall) continue;

  problems++;
  console.log(`\n${r.path} @ ${r.viewport} (statut ${r.status})`);
  if (hasOverflow) {
    console.log(`  DÉBORDEMENT de ${overflow}px (${r.docWidth} → ${r.scrollWidth})`);
    for (const g of r.guilty) {
      console.log(`    <${g.tag}> larg=${g.width} bord=${g.right} "${g.text}"`);
      console.log(`      class="${g.cls}"`);
    }
  }
  if (hasSmall) {
    console.log(`  CIBLES < 24px :`);
    for (const s of r.small) console.log(`    <${s.tag}> ${s.size} "${s.text}" class="${s.cls}"`);
  }
}

// Ne jamais annoncer un succès pour ce qui n'a pas été mesuré : une page
// sautée faute de connexion n'est pas une page saine.
const expected = PAGES.length * VIEWPORTS.length;
const measured = results.filter((r) => !r.error).length;

if (skipped > 0 || measured < expected) {
  console.log(
    `\n⚠ ${measured}/${expected} combinaisons réellement mesurées — ` +
      `${expected - measured} non testées. Le résultat ci-dessus ne vaut que pour les premières.`,
  );
}
console.log(
  problems === 0
    ? `\n✓ Aucun débordement ni cible trop petite sur ${measured} combinaison(s) mesurée(s).`
    : `\n${problems} combinaison(s) page/largeur à regarder.`,
);
