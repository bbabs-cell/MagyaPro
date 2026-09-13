# Tests — phase 21

Dernière phase de la campagne. Elle part d'un constat désagréable : **pendant
dix-sept phases, un tiers de la suite n'a jamais tourné.**

---

## Ce qui s'est réellement passé

Chaque rapport, de la phase 4 à la phase 17, se terminait par une variante de
« les suites qui demandent PostgreSQL n'ont pas pu tourner ». C'était exact,
mais le décompte affiché était trompeur :

```
Test Files  9 failed | 19 passed (28)
     Tests  2 failed | 177 passed | 120 skipped (299)
```

Les neuf fichiers échouaient bien, visiblement. Mais la ligne lue en premier —
« 177 réussis, 2 échoués » — donnait l'impression d'une suite quasi verte,
alors que **120 tests n'avaient pas été exécutés du tout**. Ce n'était pas
silencieux ; c'était noyé, ce qui revient au même quand on le lit vingt fois.

Ces 120 tests couvraient l'isolation entre commerces, les permissions, le
cycle de vie des commandes, les ventes, les achats et la caisse — c'est-à-dire
tout ce qui compte.

La phase 18 a monté PostgreSQL sur cette image et les a fait tourner. **Un seul
échouait**, et c'était un test périmé, pas un défaut du produit. Le résultat
est rassurant ; le fait qu'il ait fallu attendre la dix-huitième phase pour
l'obtenir ne l'est pas.

### Rendre l'absence impossible à confondre avec un succès

`tests/setup.ts` interroge désormais la base **une fois, avant tout**, et
échoue avec la marche à suivre plutôt qu'avec une trace de pilote répétée neuf
fois :

```
La base de test est injoignable.
  postgresql://***@localhost:5432/magyapro_test?schema=public

Ces tests s'exécutent contre un vrai PostgreSQL — un simulacre laisserait
passer précisément ce qu'ils cherchent : contraintes, cascades,
transactions et isolation entre commerces.

Pour préparer la base :
  createdb magyapro_test
  DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

L'URL est affichée avec son mot de passe masqué. Vérifié en arrêtant réellement
la base.

Cela ne rend pas la base facultative — c'est un choix assumé du projet de
tester contre un vrai moteur. Cela rend son absence **impossible à lire comme
un succès partiel**.

---

## Ce que la couverture a montré

`npm run test:coverage` est ajouté, avec `@vitest/coverage-v8` en dépendance de
développement.

| | avant | après |
|---|---|---|
| instructions (`src/lib/**`) | 34,2 % | **40,2 %** |
| branches | 73,9 % | **74,9 %** |
| tests | 317 | **349** |

Le chiffre global compte moins que sa répartition. Deux constats ressortaient :

**`src/lib/validation.ts` : 0 %.** Sept cents lignes, aucun test. C'est la
frontière entre « données reçues » et « données de confiance » — tout ce qui
entre dans le produit la traverse. Elle n'était pas couverte parce que la suite
appelle les fonctions métier directement et ne franchit donc jamais un schéma.

**`src/lib/tenant.ts` : 0 %.** Le garde de cloisonnement. Les tests
d'isolation existent, mais ils appellent les fonctions avec un identifiant de
commerce explicite : ils vérifient les requêtes, pas le garde. C'est la sonde
HTTP de la phase 20 qui l'a éprouvé, et elle ne fait pas partie de la suite.

---

## Les tests ajoutés

### `tests/validation.test.ts` — 18 tests

**Aucun défaut trouvé** : les schémas font ce qu'ils annoncent. Je l'écris
clairement parce que c'est le résultat, et qu'un test ajouté n'est pas la
preuve d'un bug corrigé.

Ils sont écrits pour la suite. Retirer un `.int()`, un `.refine()` ou une ancre
d'expression régulière ouvrirait une brèche que **rien ne signalerait** : une
valeur trop permissive ne casse aucun écran. Chaque test nomme donc ce qui
arriverait si la règle disparaissait :

- un montant décimal introduirait des fractions de centime ;
- un montant négatif transformerait une vente en remboursement ;
- `NaN` contamine toute somme qu'il touche, sans rien distinguer à l'écran ;
- la couleur de marque est injectée dans un attribut `style` — d'où le refus de
  `#000;background:url(…)` ;
- `new URL()` accepte `javascript:` ; c'est le contrôle http/https qui ferme la
  porte ;
- sans normalisation de casse sur l'e-mail, la limitation de débit par adresse
  se contournerait en changeant une majuscule.

Une attente était fausse et a été corrigée plutôt que le code : `#00ff00 `
passe, parce que `.trim()` s'applique **avant** l'expression régulière. Le
schéma a raison, mon test avait tort.

### `tests/units.test.ts` — 14 tests

La décomposition d'un stock en conditionnements (« 3 cartons + 17 bouteilles »)
est recalculée à chaque affichage. Une erreur n'altère jamais la base : elle
**montre au commerçant une quantité qu'il ne possède pas**, et rien en aval ne
la rattrape.

Le test central est un invariant vérifié sur deux cents valeurs : ce qui est
affiché doit se recomposer exactement en ce qui est en stock. S'y ajoutent les
frontières qui décident d'une couleur à l'écran — épuisé, bas, normal — et le
refus de décomposer un stock négatif, qui masquerait une anomalie derrière un
affichage d'apparence normale.

---

## L'état de la suite

**31 fichiers, 349 tests, tous au vert.** `tsc`, `eslint src/ tests/` et le
build de production sans erreur.

La suite s'exécute séquentiellement contre un vrai PostgreSQL — choix du
projet, et bon choix : un simulacre de Prisma laisserait passer exactement ce
que ces tests cherchent.

Trois sondes complètent la suite sans en faire partie, parce qu'elles
demandent l'application en marche :

| script | ce qu'il éprouve |
|---|---|
| `scripts/audit-responsive.mjs` | débordements et cibles tactiles, à quatre largeurs |
| `scripts/audit-authz.mjs` | accès croisé entre commerces, en HTTP |
| `scripts/audit-upload.mjs` | fichiers dont le contenu ment sur le nom |

Chacune porte son avertissement de calibrage : **une sonde qui n'atteint rien
affiche « aucun problème » et ne prouve rien.** Les deux dernières exigent un
contrôle positif explicite.

---

## Ce qui reste découvert, et pourquoi

**Les gardes de route et les permissions fines, dans la suite.** La sonde HTTP
de la phase 20 les éprouve, mais elle vit à côté des tests, et exige un serveur
lancé. Les intégrer demanderait de démarrer l'application depuis la suite —
faisable, et le complément le plus utile à ce socle.

**Les composants React.** Aucun test de rendu : ni bibliothèque de test DOM, ni
environnement `jsdom` configurés. Les défauts de rendu trouvés dans cette
campagne l'ont été par mesure dans un vrai navigateur, ce qui est plus fidèle
mais ne tourne pas en intégration continue.

**Les modules à 0 % restants** sont surtout des couches d'accès aux données
(`analytics`, `reports`, `insights`) : les tester utilement demande des
scénarios de données complets, pas des cas isolés. C'est un chantier en soi,
et il vaut mieux l'annoncer que de le simuler avec des tests qui ne
vérifieraient que leurs propres montages.

**Le test humain.** Lancez `npm test` sur votre poste. S'il refuse en indiquant
la marche à suivre, c'est le nouveau contrôle qui fonctionne. Puis
`npm run test:coverage` : le rapport HTML est écrit dans `coverage/`, déjà
ignoré par git.
