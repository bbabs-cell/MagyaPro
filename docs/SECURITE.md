# Sécurité — phase 20

Audit conduit sur l'application en marche, avec de vraies sessions : les
contrôles ont été **attaqués**, pas seulement relus. Une lecture de code dit ce
que le code a l'air de faire ; une requête dit ce qu'il fait.

Le socle est solide. Les trois défauts trouvés ne sont pas des trous de
sécurité : ce sont deux fonctionnalités **cassées par un contrôle de sécurité
qui faisait correctement son travail**, et une dépendance morte.

Aucune migration n'a été nécessaire.

---

## Ce qui a été attaqué, et a tenu

### Cloisonnement entre commerces

Session ouverte sur un restaurant, puis huit tentatives d'atteindre les
ressources d'un autre par leur identifiant, en HTTP, avec les cookies de la
session :

| tentative | réponse |
|---|---|
| lire / modifier / supprimer un plat du voisin | 404 |
| renommer une catégorie du voisin | 404 |
| lire / annuler une commande du voisin | 404 |
| atteindre l'administration de la plateforme | 404 |

**Aucune n'a abouti.** Les réponses sont des 404 et non des 403, ce qui est le
bon choix : un 403 confirmerait que la ressource existe.

Les tests unitaires couvraient déjà cette isolation, mais ils appellent les
fonctions métier directement. Cette sonde passe par les **gardes de route**,
qui sont l'autre couche, et la seule qu'un attaquant rencontre.

**Contrôle positif** : la même sonde, lancée sur les ressources du commerce
attaquant lui-même, renvoie des 200. Sans cette calibration, une sonde qui
n'atteint rien du tout afficherait « aucune fuite » et ne prouverait rien.
J'ai d'abord lancé la sonde avec un compte qui portait encore un rôle Super
Admin accordé en phase 18 pour mesurer des écrans : le résultat était flatteur
et sans valeur. Rôle révoqué, sonde relancée.

### Téléversement de fichiers

| fichier envoyé | réponse |
|---|---|
| script PHP nommé `.png` | 400 |
| HTML nommé `.jpg` | 400 |
| SVG — vecteur scriptable | 400 |
| PNG authentique | 201 |

Le type est décidé par la **signature binaire** du contenu, jamais par le nom
ni par le type annoncé. L'extension du fichier stocké est déduite de cette
détection, si bien que nom et contenu ne peuvent pas diverger. Le refus du SVG
est notable : c'est un vecteur classique de script injecté.

### Limitation de débit

Douze tentatives de connexion avec un mauvais mot de passe : **huit 401, puis
429** à partir de la neuvième. Deux compteurs distincts, par adresse IP et par
adresse e-mail — le premier contre le balayage de comptes, le second contre le
bourrage d'un compte depuis plusieurs adresses.

### Le reste, vérifié

| | état |
|---|---|
| mots de passe | scrypt (RFC 7914), sel aléatoire, comparaison à temps constant |
| jetons de session, codes de secours 2FA | hachés en base, jamais en clair |
| cookie de session | `httpOnly`, `secure` en production, `sameSite=lax` |
| en-têtes | CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS, `Permissions-Policy` |
| `dangerouslySetInnerHTML` | 3 emplois, tous sûrs — celui des données structurées échappe `<` pour empêcher la fermeture de la balise `script` |
| SQL brut | un seul `SELECT 1`, dans la sonde de santé |
| optimiseur d'images Next | fermé — `remotePatterns` vide, toute image distante refusée |
| en-têtes `x-locale` / `x-public-site` (phase 19) | **non falsifiables** : le middleware les écrit sur chaque branche et supprime `x-locale` quand aucune langue valide n'est demandée. Vérifié en les envoyant depuis un client. |

---

## Les trois défauts

### 1. La politique de sécurité bloquait les polices des vitrines

`style-src` n'autorise que le domaine du site. Les vitrines chargeaient leur
police depuis `fonts.googleapis.com` par une balise `<link>` : **le navigateur
refusait la feuille de style**, silencieusement.

Conséquence : un restaurateur choisissait sa police, l'enregistrait, et rien ne
changeait sur son site. C'est exactement le défaut que votre règle interdit —
une commande qui enregistre une valeur et ne change rien.

Deux issues : ouvrir la politique de sécurité à Google, ou héberger les cinq
polices avec le reste de l'application. **La seconde est retenue** : elle ne
relâche aucune règle, et elle évite d'envoyer l'adresse IP de chaque visiteur
d'une vitrine à un tiers. C'est la même décision qu'en phase 17 pour Manrope.

`preload: false` sur les cinq : une vitrine n'en applique qu'une, et le
navigateur ne télécharge que le fichier dont il a besoin.

### 2. …et ce n'était que la première des deux causes

Après correction, la police choisie **ne s'appliquait toujours pas**. Mesurée
dans le navigateur : toujours Manrope.

L'enveloppe de la vitrine redéfinissait bien `--font-sans`, mais
`font-family: var(--font-sans)` est calculé sur `body`, avec la valeur que la
variable a **à ce niveau**. Redéfinir la variable sur un descendant ne change
pas ce calcul : le descendant hérite simplement de la police déjà résolue.

L'enveloppe redemande maintenant la résolution. Vérifié sur les quatre polices
proposées : chacune s'applique réellement.

**Sans mesure dans un navigateur, j'aurais annoncé cette fonctionnalité
réparée alors qu'elle ne l'était qu'à moitié.**

### 3. Les images téléversées répondaient 404

Les fichiers sont écrits sous `public/uploads`. Or **Next.js ne sert de
`public/` que ce qui s'y trouvait au démarrage du serveur** : une photo envoyée
après coup répondait 404 jusqu'au redémarrage suivant.

Le pilote de stockage local est **celui par défaut**. Tout déploiement qui n'a
pas configuré de stockage objet perdait donc l'affichage de toutes ses images —
alors que l'envoi réussissait et que l'URL était enregistrée en base. Toute la
phase 15 (cadrage, briefs, compression) était en aval de ce trou.

Les fichiers passent désormais par une route dédiée, écrite comme une route qui
lit des fichiers depuis une URL doit l'être :

- la clé repasse par **le même contrôle de chemin qu'à l'écriture** ;
- le type de contenu vient d'une **liste fermée**, d'après une extension que le
  serveur a lui-même décidée à partir de la signature binaire ;
- toute extension inconnue est refusée plutôt que servie sans type ;
- la route ne répond pas du tout si le stockage objet est configuré.

Vérifié : l'image répond 200 en `image/png`, et cinq tentatives de sortie du
répertoire — `../`, `..%2f`, chemins imbriqués, extensions étrangères —
répondent toutes 404.

---

## Dépendances

`npm audit --omit=dev` : **11 vulnérabilités (8 élevées) → 8 (5 élevées)**.

**`swagger-ui-react` supprimé.** Dépendance de production **importée nulle
part** — vérifié sur tout le dépôt. Elle tirait à elle seule la chaîne
`js-yaml`. Retirer ce qui ne sert pas est la correction la plus sûre qui soit.

**`nodemailer` porté en 9.1.1**, à l'intérieur de sa version majeure. L'avis
concerne `resolveContent()` sur les pièces jointes ; **ce produit n'en envoie
aucune**, la faille n'était donc pas atteignable. Je n'ai pas tenté le passage
en 10.x : une bibliothèque d'envoi d'e-mails qui se casse en silence
supprimerait les réinitialisations de mot de passe, ce qui est un risque plus
grand que l'avis corrigé. À faire dans un changement séparé, avec un envoi
réel à vérifier.

**Les cinq avis restants ne sont pas atteignables** : `prisma`,
`@prisma/config`, `deepmerge-ts` et `postcss` n'interviennent qu'à la
construction ; `sharp` n'est appelé que par l'optimiseur d'images de Next, dont
j'ai vérifié qu'il refuse toute source distante.

---

## Deux durcissements que je n'ai pas faits seul

**`script-src 'unsafe-inline'`.** C'est la faiblesse réelle de la politique de
sécurité : elle affaiblit la protection contre le script injecté. Next.js
dépend de scripts en ligne pour l'hydratation ; la corriger proprement demande
une valeur à usage unique (`nonce`) posée par le middleware et propagée à
chaque script, ce qui touche tout le rendu. `object-src 'none'` et
`base-uri 'self'` sont déjà verrouillés, ce qui couvre les débordements les
plus graves.

**HSTS sans `includeSubDomains`.** Les vitrines sont servies sur des
sous-domaines, qui ne sont donc pas couverts. L'ajouter serait correct — mais
un navigateur **mémorise cette directive pour un an** : si un seul sous-domaine
n'est pas servi en HTTPS, il devient inaccessible, et l'on ne peut pas revenir
en arrière côté visiteur. C'est une décision d'exploitation, pas un correctif :
je vous la laisse.

---

## Reproductible

`scripts/audit-authz.mjs` et `scripts/audit-upload.mjs` rejouent les deux
sondes. Le premier porte en tête l'avertissement de calibrage : **toujours le
lancer aussi sur ses propres ressources**, faute de quoi « aucune fuite » ne
veut rien dire.

`playwright-core` s'installe sans être enregistré (`--no-save`) :
`package.json` ne gagne aucune dépendance.

**29 fichiers, 317 tests, tous au vert.** `tsc`, `eslint src/ tests/` et le
build de production sans erreur.

---

## Ce que cette phase n'a pas couvert

**Le parcours de paiement chez les fournisseurs.** Les webhooks vérifient leur
signature — c'était déjà audité — mais je n'ai pas rejoué de paiement complet
avec un fournisseur réel.

**Les permissions fines par rôle, en HTTP.** La sonde éprouve le cloisonnement
entre commerces. À l'intérieur d'un même commerce, un employé qui tenterait une
action réservée à l'administrateur n'a pas été testé par requête — seulement
par les tests unitaires de rôles.

**La résistance à la charge.** La limitation de débit fonctionne ; son
comportement sous un afflux distribué n'a pas été éprouvé.

**Le test humain.** Choisissez une police dans Apparence, enregistrez, et
ouvrez votre vitrine : elle doit réellement changer. Puis téléversez une photo
de plat et rechargez la page publique — elle doit s'afficher immédiatement,
sans redémarrage.
