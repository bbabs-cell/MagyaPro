# Audit MagyaPro — phase 1

Établi avant la campagne de refonte en 21 phases. **Lecture seule : aucune
ligne de code n'a été modifiée pour produire ce document.**

Tout ce qui suit a été vérifié dans le dépôt. Ce qui n'a pas pu l'être depuis
cette session — le rendu réel des écrans, le comportement sur un vrai appareil —
est signalé comme tel plutôt que supposé.

---

## 1. État actuel

### Surface du produit

| | Pages | Routes d'API |
|---|---|---|
| Tableau de bord Restaurant | 26 | 68 |
| Tableau de bord Boutique | 23 | 49 |
| Super Admin | 17 | 28 |
| Sites publics des restaurants | 10 | — |
| Marketing, authentification, reçus | 20 | 10 (publiques) |
| **Total** | **96** | **155** |

### Contrôle d'accès

Sur les 145 routes non publiques, **toutes** passent par un garde
(`requireTenant`, `requireStore`, `requireSuperAdmin` ou `getCurrentUser`).
Douze routes s'en passent volontairement ; quatre méritaient un examen, les
quatre sont saines :

- **Tâche planifiée d'abonnements** — protégée par un secret partagé, accepté
  en en-tête dédié ou en jeton porteur.
- **Webhook de paiement Wave** — signature HMAC vérifiée avant tout traitement,
  avec comparaison à temps constant.
- **Changement de boutique active** — l'appartenance de l'utilisateur à la
  boutique est vérifiée avant d'écrire le cookie.
- **Changement de restaurant actif** — même principe.

Le cloisonnement repose sur un principe appliqué partout : le commerce est
résolu côté serveur depuis la session, et le filtre fait partie de la requête —
une ressource d'un autre commerce n'est jamais chargée en mémoire.

### Pages légales

Les trois existent et sont liées depuis les pieds de page : mentions légales,
politique de confidentialité, conditions générales. Aucun lien mort parmi elles.

---

## 2. 🔴 Critique

### C1. Deux avis de sécurité critiques sur Next.js

Version installée : **15.5.23**. Deux vulnérabilités d'exécution de code à
distance la concernent.

La première ne s'applique pas : elle vise les serveurs hébergés sous Windows,
or le produit tourne sur Vercel.

**La seconde s'applique.** Elle vise l'API d'optimisation d'images lorsqu'un
fichier AVIF est traité. Or le format AVIF est explicitement accepté à l'envoi,
et l'hôte de stockage est déclaré comme source d'images autorisée en
production. Le chemin existe donc : un compte commerçant peut déposer un
fichier AVIF, puis le faire traiter par l'optimiseur.

Atténuation actuelle : aucun écran n'utilise le composant image de Next, et
l'envoi exige un compte. Cela réduit la portée, ne la supprime pas.

**Correctif : monter Next.js de version.** À faire avant toute mise en vente.

### C2. Onze vulnérabilités de dépendances

Une critique, huit hautes, deux modérées : `next`, `js-yaml`, `nodemailer`,
`postcss`, `sharp` (indirecte, via Next), `uuid`, `deepmerge-ts`.

Certaines corrections sont sans risque, d'autres imposent un changement de
version majeure et doivent être testées. À traiter en phase 20, sauf C1 qui ne
peut pas attendre.

### C3. Aucun retour visuel pendant une action — la cause du §8

Mesuré dans le dépôt :

- **133 appels** à la revalidation serveur, répartis dans **70 fichiers** ;
- **zéro** usage de `useTransition` ;
- **zéro** usage de `useOptimistic` ;
- **71 pages** forcent un rendu serveur à chaque visite.

Le déroulé actuel d'une action est donc : l'utilisateur valide, la requête
part, le serveur rejoue **toute la page** et ses requêtes de base, le HTML
revient, l'écran change.

Sans `useTransition`, **rien n'indique que quelque chose est en cours**.
L'écran paraît figé, puis saute. C'est exactement la sensation décrite au §8 :
« plusieurs secondes ou un refresh manuel avant de voir le résultat ». Le
mécanisme fonctionne, mais il est muet.

Sur une connexion de la zone, avec une base distante, le temps ressenti se
compte en secondes.

---

## 3. 🟠 Important

### I1. Le rôle Cuisine n'existe pas, alors que l'écran existe

L'écran cuisine est présent. La base ne connaît que quatre rôles : propriétaire,
administrateur, employé, livreur. Un cuisinier reçoit donc aujourd'hui les
droits complets d'un employé.

Créer le rôle demande une modification de la base — protocole habituel :
fichier SQL, exécution par le propriétaire, confirmation, puis publication.

### I2. Poids inutile dans le paquet livré

`swagger-ui-react` est toujours une dépendance alors que la documentation d'API
a été retirée du produit. À vérifier en phase 20 : si plus rien ne l'importe,
elle part.

### I3. Une page sur deux impose un aller-retour complet

Les 71 pages en rendu forcé interrogent la base à chaque visite, y compris pour
des écrans dont le contenu bouge peu. Une partie est légitime — la caisse, les
commandes en cours. Une autre ne l'est pas.

---

## 4. 🟡 Améliorations

- **Typographie (§6)** — **tranché en phase 17, en faveur du §6.** Manrope est
  adoptée pour le corps de texte : 24 Ko de plus au premier chargement, mesurés
  dans le build. Le conflit avec le §8 est amorti par le repli aux métriques
  ajustées de `next/font` — le texte change de dessin sans se déplacer. Voir
  docs/TYPOGRAPHIE.md.
- **Direction photographique (§21)** — **tranché en phase 15** : outillage
  produit et briefs, pas d'images générées. Voir docs/PHOTOS.md.
- **Super Admin (§23-27)** — **traité en phase 16.** La navigation a été
  regroupée en deux univers de premier niveau, et trois défauts sur les
  chiffres ont été corrigés en chemin. Voir docs/SUPER-ADMIN.md.
  Note d'origine : la navigation a été réorganisée en cinq sections
  il y a deux jours. Le prompt demande deux univers de premier niveau,
  Restaurants et Boutiques. C'est une évolution de ce qui existe, pas une
  reprise à zéro.

---

## 5. 🟢 Polish

À traiter en fin de parcours, une fois les phases fonctionnelles closes :
animations d'apparition, transitions de cartes, états de chargement soignés,
micro-interactions. Le socle est là — la réduction des animations est déjà
respectée, les indicateurs de chargement et les états vides existent.

---

## 6. Risques techniques

1. **La montée de version de Next** peut introduire des régressions de rendu.
   À faire seule, dans sa propre phase, avec une vérification écran par écran.
2. **Le rôle Cuisine** touche aux permissions. Une erreur y ouvre des données à
   quelqu'un qui ne doit pas les voir.
3. **L'affichage optimiste** est la modification la plus délicate du programme :
   mal fait, il annonce une réussite que le serveur a refusée. Chaque cas devra
   avoir son retour en arrière et son test.
4. **Les unités par secteur (§10)** touchent à des données déjà saisies. Filtrer
   les unités ne doit jamais rendre invisible une unité déjà utilisée par un
   produit existant.

## 7. Risques de régression

- Le cloisonnement entre commerces — à revérifier après toute modification de
  chargement de données.
- Les permissions — à revérifier après toute modification de rôle.
- Le parcours de commande public — c'est le chemin qui rapporte l'argent.
- L'impression des documents — vérifiée sur le papier seulement, donc par le
  propriétaire.

## 8. Ce que cette session ne peut pas vérifier

Ni base de données, ni navigateur. Sont donc contrôlables ici : les types, le
lint, les tests, la construction, les règles métier, le détecteur de design.
Ne le sont pas : le rendu réel, le comportement tactile, la vitesse ressentie,
l'impression.

Les captures d'écran du propriétaire ont déjà révélé trois défauts que le code
seul ne montrait pas. Le test humain à chaque phase n'est pas une formalité.

---

## 9. Plan d'exécution

L'ordre des 21 phases du prompt est conservé. Deux écarts proposés, à valider :

**La montée de version de Next (C1) est remontée avant tout le reste.** C'est
une faille critique sur un produit qui s'apprête à être commercialisé ; la
laisser en phase 20 reviendrait à construire vingt phases sur une base connue
comme vulnérable.

**Les phases 1 à 3 ne produisent aucun code** — ce document et la cartographie.

Chaque phase se termine par : vérifications automatiques, audit de sécurité sur
le périmètre touché, test par le propriétaire, feu vert. Une phase n'est close
que si rien d'existant n'est cassé.
