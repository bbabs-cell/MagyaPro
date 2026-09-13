import { chromium } from 'playwright-core';

/**
 * Sonde d'autorisation : tentative d'accès croisé entre commerces.
 *
 * PRÉREQUIS : base peuplée, application lancée (`npm run build && npm run
 * start`), et `npm i --no-save playwright-core`.
 *
 * USAGE
 *   node scripts/audit-authz.mjs '<json de la cible>' 'email:motdepasse'
 *   où le JSON porte productId / categoryId / orderId d'un AUTRE commerce.
 *
 * CALIBRAGE — indispensable : lancez-la aussi avec les identifiants des
 * ressources du commerce attaquant lui-même. Des 200 doivent alors apparaître.
 * Sans ce contrôle positif, une sonde qui n'atteint rien du tout affiche
 * « aucune fuite » et ne prouve absolument rien.
 *
 * Les tests unitaires appellent les fonctions métier directement. Cette sonde
 * passe par HTTP avec une vraie session : elle éprouve les gardes de route,
 * qui sont une couche différente et la seule qu'un attaquant rencontre.
 *
 * Principe : ouvrir une session sur le restaurant A, puis demander les
 * ressources du restaurant B par leur identifiant. Toute réponse 200 est un
 * défaut d'isolation.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const [victimJson, attackerCreds] = process.argv.slice(2);
const victim = JSON.parse(victimJson);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const context = await browser.newContext();
const page = await context.newPage();

const [email, password] = attackerCreds.split(':');
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/connexion'), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
console.log(`Session ouverte : ${email}\n`);

/** Exécute une requête depuis le contexte authentifié (cookies inclus). */
async function attempt(method, path, body) {
  return page.evaluate(
    async ([method, path, body]) => {
      try {
        const response = await fetch(path, {
          method,
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        let preview = '';
        try {
          preview = (await response.text()).slice(0, 90).replace(/\s+/g, ' ');
        } catch {
          preview = '(corps illisible)';
        }
        return { status: response.status, preview };
      } catch (error) {
        return { status: 0, preview: String(error).slice(0, 80) };
      }
    },
    [method, path, body],
  );
}

const attempts = [
  ['GET', `/api/menu/produits/${victim.productId}`, null, 'lire un plat du voisin'],
  ['PATCH', `/api/menu/produits/${victim.productId}`, { isAvailable: false }, 'modifier un plat du voisin'],
  ['DELETE', `/api/menu/produits/${victim.productId}`, null, 'supprimer un plat du voisin'],
  ['PATCH', `/api/menu/categories/${victim.categoryId}`, { name: 'pirate' }, 'renommer une catégorie du voisin'],
  ['GET', `/api/commandes/${victim.orderId}`, null, 'lire une commande du voisin'],
  ['PATCH', `/api/commandes/${victim.orderId}/statut`, { status: 'CANCELLED' }, 'annuler une commande du voisin'],
  ['GET', `/api/admin/restaurants`, null, 'atteindre l’administration plateforme'],
  ['GET', `/api/admin/utilisateurs`, null, 'lister les utilisateurs de la plateforme'],
];

let leaks = 0;
for (const [method, path, body, label] of attempts) {
  const { status, preview } = await attempt(method, path, body);
  // 2xx = la ressource a répondu ; c'est un défaut d'isolation.
  const leaked = status >= 200 && status < 300;
  if (leaked) leaks++;
  console.log(
    `${leaked ? '⚠ FUITE ' : '✓ refusé'} [${String(status).padStart(3)}] ${method.padEnd(6)} ${label}`,
  );
  if (leaked) console.log(`         → ${preview}`);
}

console.log(
  leaks === 0
    ? `\n✓ ${attempts.length} tentatives, aucune n'a abouti.`
    : `\n⚠ ${leaks} fuite(s) sur ${attempts.length} tentatives.`,
);

await browser.close();
process.exit(leaks === 0 ? 0 : 1);
