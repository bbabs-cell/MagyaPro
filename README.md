# Magya

Plateforme SaaS multi-tenant permettant à des restaurants de créer rapidement
un site professionnel : menu, commandes en ligne, livraison, statistiques et
abonnement, avec une isolation stricte des données entre restaurants.

## Stack technique

- **Framework** : Next.js 15 (App Router), React 19, TypeScript strict
- **Base de données** : PostgreSQL + Prisma ORM
- **Style** : Tailwind CSS
- **Authentification** : sessions à jetons hachés, cookies httpOnly (aucune
  dépendance tierce)
- **Tests** : Vitest, contre une vraie base PostgreSQL de test

## Architecture

```
Platform
 └─ Tenant (Restaurant)
     ├─ Users (RestaurantUser : OWNER / ADMIN / EMPLOYEE)
     ├─ Menu (Category, Product, ProductVariant, ProductOption)
     ├─ Orders (Order, OrderItem, OrderStatusEvent)
     ├─ Customers
     ├─ Payments (architecture par fournisseur, voir src/lib/payments)
     ├─ Analytics
     └─ Settings, Domains, Subscription
```

Le tenant est **toujours** résolu côté serveur à partir de la session
(`src/lib/tenant.ts`) — jamais depuis un identifiant fourni par le client.
Toute requête sur une ressource tenant (catégorie, commande, client…) passe
par un filtre `restaurantId` dérivé de la session.

Points d'entrée principaux :

| Domaine | Rôle |
|---|---|
| `magya.app` | Landing, authentification, dashboard restaurant, administration |
| `<slug>.magya.app` ou domaine personnalisé | Site public du restaurant (résolu par `src/middleware.ts` → `src/app/r/[host]`) |

## Démarrage local

### Prérequis

- Node.js 20+
- PostgreSQL 14+ (local ou distant)

### Installation

```bash
npm install
cp .env.example .env
# éditez .env : DATABASE_URL, TEST_DATABASE_URL, SESSION_SECRET, etc.
```

### Base de données

```bash
npm run db:migrate     # applique les migrations (crée la base si besoin)
npm run db:seed        # plans, templates, compte Super Admin + démo
```

Le seed crée :
- 3 plans (Starter, Pro, Premium) et 5 templates ;
- un compte Super Admin (`SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`
  dans `.env`) ;
- 3 restaurants de démonstration (`isDemo: true`, non indexables, bandeau
  visible sur leur site public) avec menu, commandes et clients réalistes.

Pour supprimer uniquement les données de démonstration :

```bash
npx tsx prisma/seed.ts -- --clean-demo
```

Pour ne charger que les données de référence (sans démo) :

```bash
npx tsx prisma/seed.ts -- --no-demo
```

### Lancer l'application

```bash
npm run dev
```

Par défaut, `APP_ROOT_DOMAIN=magya.localhost:3000`. Pour tester le
sous-domaine d'un restaurant en local, ajoutez à `/etc/hosts` :

```
127.0.0.1  magya.localhost demo-la-terrasse.magya.localhost demo-chez-aminata.magya.localhost demo-burger-lab.magya.localhost
```

Puis ouvrez `http://demo-la-terrasse.magya.localhost:3000`.

### Tests

```bash
npm test
```

Les tests s'exécutent contre `TEST_DATABASE_URL`, une base **distincte** de
`DATABASE_URL` (le setup refuse de démarrer si les deux coïncident, pour ne
jamais purger la base de développement par erreur).

La suite `tests/multi-tenancy.test.ts` est la plus critique : elle vérifie
qu'un restaurant ne peut atteindre aucune donnée d'un autre (menu, commandes,
clients, paiements, promotions, notifications, adhésions).

### Autres scripts

```bash
npm run build          # build de production (prisma generate + next build)
npm run start           # sert le build de production
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run db:studio        # interface Prisma Studio
npm run db:reset         # réinitialise la base (⚠ destructif)
```

## Variables d'environnement

Voir `.env.example` pour la liste complète et leur documentation. Aucun
secret n'est committé ; `.env` est ignoré par git.

Points notables :
- `STORAGE_DRIVER` : `local` par défaut (écrit dans `public/uploads`). Un
  pilote objet (S3, R2…) s'ajoute en implémentant `StorageDriver`
  (`src/lib/storage/types.ts`) et en l'enregistrant dans
  `src/lib/storage/index.ts`.
- `MAIL_DRIVER` : `console` par défaut (les emails sont journalisés côté
  serveur, utile en développement). Un pilote SMTP s'ajoute de la même façon
  dans `src/lib/mail/index.ts`.
- Les fournisseurs de paiement (`src/lib/payments/`) suivent le même principe :
  `cash_on_delivery` et `pay_at_store` sont opérationnels immédiatement ;
  Orange Money et Wave sont déclarés mais `isAvailable()` renvoie `false`
  tant que leurs identifiants d'API ne sont pas renseignés — ils
  n'apparaissent alors jamais dans le tunnel de commande.

## Sécurité — points structurants

- **Mots de passe** : hachés avec scrypt (Node natif), jamais en clair.
- **Sessions** : jetons opaques, seul leur hash SHA-256 est stocké en base ;
  cookies `httpOnly`, `SameSite=Lax`, `Secure` en production.
- **Montants** : toujours recalculés côté serveur
  (`src/lib/orders/pricing.ts`) à partir de la base, jamais acceptés du
  client. Voir `tests/pricing.test.ts`.
- **Isolation tenant** : voir `src/lib/tenant.ts` et
  `tests/multi-tenancy.test.ts`.
- **Permissions** : système par permissions (`src/lib/rbac.ts`), vérifiées
  côté serveur sur chaque route sensible via `requireTenant(permission)`.
- **Abonnements** : les fonctionnalités payantes sont vérifiées côté serveur
  (`src/lib/entitlements.ts`), pas seulement masquées dans l'interface.
- **Audit** : `src/lib/audit.ts` journalise les actions sensibles, y compris
  celles du Super Admin (accès support, suspension, suppression).

## Déploiement

1. Provisionnez une base PostgreSQL et renseignez `DATABASE_URL`.
2. `npm run db:deploy` (applique les migrations sans prompt interactif).
3. `npm run db:seed` pour les données de référence (plans, templates,
   Super Admin) — ajoutez `-- --no-demo` pour omettre les restaurants de
   démonstration en production.
4. `npm run build` puis `npm run start`, ou déployez sur une plateforme
   compatible Next.js (le projet n'utilise aucune API spécifique à un
   hébergeur).
5. Configurez `APP_ROOT_DOMAIN` sur le domaine réel, avec un DNS wildcard
   (`*.magya.app`) pointant vers l'application, pour que chaque nouveau
   restaurant obtienne son sous-domaine sans intervention manuelle.
6. Pour le stockage des images en production multi-instance, configurez un
   pilote objet plutôt que `local` (voir ci-dessus).
7. Sauvegardes : configurez des sauvegardes régulières de PostgreSQL
   (`pg_dump` planifié ou solution managée de votre hébergeur) — c'est la
   seule donnée d'état de l'application.
