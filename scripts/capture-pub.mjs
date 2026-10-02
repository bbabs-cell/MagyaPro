/**
 * Captures produit pour la publicité.
 *
 * Une publicité qui montre le produit doit montrer **le produit**, pas une
 * maquette. Ces captures sont donc prises sur l'application réellement
 * construite, connectée à la base de démonstration — ce qui apparaît à
 * l'écran existe et fonctionne.
 *
 * ## Pourquoi un script et pas un dossier d'images
 *
 * Les captures d'une première série ont été perdues avec le conteneur qui les
 * portait. Déposer des PNG dans le dépôt les aurait figés : au premier
 * changement d'écran, la publicité montrerait une version qui n'existe plus,
 * et personne ne s'en apercevrait. Le script, lui, redonne la série à jour en
 * une commande, et se corrige quand un écran change.
 *
 * ## Emploi
 *
 *   npm run build && npm run start          # le serveur doit tourner
 *   npx prisma db seed                      # comptes de démonstration
 *   node scripts/capture-pub.mjs            # -> ./captures-pub/
 *
 * Variables : BASE_URL (défaut http://localhost:3000), OUT_DIR,
 * CHROMIUM_PATH, DEMO_PASSWORD.
 *
 * ## Ce qui est capturé, et pourquoi
 *
 * Deux séries, parce qu'une publicité en a besoin de deux :
 *
 * - **Téléphone (390 × 844)** — c'est l'appareil du commerçant, et c'est ce
 *   qu'on voit dans sa main à l'écran. La série principale.
 * - **Ordinateur (1440 × 900)** — pour les plans larges où l'écran remplit le
 *   cadre, et pour les écrans trop denses pour un téléphone.
 *
 * Chaque capture porte un nom qui dit ce qu'elle prouve, pas où elle a été
 * prise : `02-menu-plat-epuise` plutôt que `dashboard-menu`. Le monteur
 * cherche un argument, pas une route.
 */
import pw from 'playwright-core';
import { mkdirSync } from 'node:fs';

const { chromium } = pw;

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT_DIR ?? `${process.cwd()}/captures-pub`;
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo!2345';

const VIEWPORTS = [
  { name: 'tel', width: 390, height: 844 },
  { name: 'bureau', width: 1440, height: 900 },
];

/**
 * Écrans publics : ce que voit le client du restaurant. Aucun compte requis.
 */
const PUBLIC_SHOTS = [
  { file: '01-vitrine-client', path: '/r/demo-chez-aminata' },
  { file: '02-menu-client', path: '/r/demo-chez-aminata/menu' },
  { file: '03-page-restaurant', path: '/restaurant' },
  { file: '04-page-boutique', path: '/boutique' },
];

/**
 * Écrans du commerçant. Connexion requise ; chaque entrée dit avec quel
 * compte, parce que Restaurant et Boutique sont deux produits distincts.
 */
const RESTAURANT_SHOTS = [
  { file: '10-vue-ensemble', path: '/dashboard' },
  { file: '11-commandes', path: '/dashboard/commandes' },
  { file: '12-prise-de-commande', path: '/dashboard/commandes/nouvelle' },
  { file: '13-carte', path: '/dashboard/menu' },
  // L'écran de préparation : c'est lui qui prouve « le bon part en cuisine ».
  { file: '15-cuisine', path: '/dashboard/cuisine' },
  { file: '14-statistiques', path: '/dashboard/statistiques' },
];

const BOUTIQUE_SHOTS = [
  { file: '20-caisse', path: '/boutique/dashboard/caisse' },
  { file: '21-stock', path: '/boutique/dashboard/produits' },
  { file: '24-previsions', path: '/boutique/dashboard/previsions' },
  { file: '22-clients-credit', path: '/boutique/dashboard/clients' },
  { file: '23-tableau-de-bord', path: '/boutique/dashboard' },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

const taken = [];
const missed = [];

/** Une capture, et la trace de ce qui a échoué — un écran manquant ne doit
 *  pas passer pour un écran vide. */
async function shoot(page, file, path, viewport) {
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const status = response?.status() ?? 0;
  if (status !== 200) {
    missed.push(`${file} (${viewport}) — HTTP ${status} sur ${path}`);
    return;
  }

  // Le bandeau de cookies masque le bas de chaque écran : il n'a rien à faire
  // dans une publicité, et il est accepté plutôt que caché au CSS — c'est le
  // geste qu'un vrai visiteur ferait.
  const accept = page.getByRole('button', { name: /accepter/i });
  if (await accept.count()) await accept.first().click().catch(() => {});

  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${file}-${viewport}.png`, fullPage: false });
  taken.push(`${file}-${viewport}`);
}

/**
 * Restaurant et Boutique sont deux produits, avec deux écrans de connexion.
 * Passer par `/connexion` pour un compte Boutique échoue — c'est ce qui
 * laissait toute la série Boutique manquante.
 */
async function signIn(context, email, loginPath) {
  const page = await context.newPage();
  await page.goto(`${BASE}${loginPath}`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // La redirection est faite par le client après la réponse de l'API : à cet
  // instant le réseau est déjà calme, donc attendre `networkidle` revenait à
  // relever l'adresse avant qu'elle ne change — et à conclure que la
  // connexion avait échoué alors qu'elle venait de réussir.
  const ok = await page
    .waitForURL((url) => new URL(url).pathname !== loginPath, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  await page.close();
  return ok;
}

for (const viewport of VIEWPORTS) {
  const size = { width: viewport.width, height: viewport.height };

  // --- Écrans publics, sans compte.
  const anonymous = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  const page = await anonymous.newPage();
  for (const shot of PUBLIC_SHOTS) await shoot(page, shot.file, shot.path, viewport.name);
  await anonymous.close();

  // --- Restaurant et Boutique, chacun dans sa propre session.
  for (const [email, loginPath, shots] of [
    ['demo-chez-aminata@demo.magyapro.app', '/connexion', RESTAURANT_SHOTS],
    ['demo-boutique@demo.magyapro.app', '/boutique/connexion', BOUTIQUE_SHOTS],
  ]) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
    if (!(await signIn(context, email, loginPath))) {
      missed.push(`connexion refusée pour ${email} (${viewport.name}) — série entière manquante`);
      await context.close();
      continue;
    }
    const signedIn = await context.newPage();
    for (const shot of shots) await shoot(signedIn, shot.file, shot.path, viewport.name);
    await context.close();
  }
}

await browser.close();

console.log(`${taken.length} captures dans ${OUT}`);
for (const name of taken) console.log(`  ✓ ${name}`);
if (missed.length) {
  console.log(`\n${missed.length} manquante(s) :`);
  for (const reason of missed) console.log(`  ✗ ${reason}`);
  process.exitCode = 1;
}
