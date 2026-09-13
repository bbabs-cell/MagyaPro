# SEO — phase 19

L'audit a été fait sur les pages réellement servies, pas sur le code : chaque
`<head>`, chaque `robots.txt`, chaque sitemap a été récupéré du serveur et lu.

Le socle était bon. Les sitemaps par restaurant, les `robots.txt` par vitrine,
les données structurées `Restaurant`, l'exclusion des démonstrations, le
`noindex` sur le panier : tout cela existait et fonctionne.

Un défaut dominait, et il annulait une phase entière de travail.

Aucune migration n'a été nécessaire.

---

## Les traductions n'existaient pour aucun moteur de recherche

La phase 14 a traduit les sept modèles de vitrine en anglais et en arabe. La
langue du visiteur est retenue dans un **cookie**.

**Un moteur de recherche n'envoie pas de cookie.**

Chaque robot recevait donc invariablement la version française, sur une URL
unique, sans rien qui signale l'existence des deux autres langues. Aucune page
anglaise ni arabe n'était atteignable, donc aucune n'était indexable. Le
travail de traduction était intégralement invisible en recherche.

### Ce qui change : une adresse par langue

Le cookie reste — c'est le confort d'un visiteur qui revient. Mais l'URL peut
désormais porter la langue, et **elle prime** :

```
https://la-terrasse.com/menu            → français (adresse de référence)
https://la-terrasse.com/menu?lang=en    → anglais
https://la-terrasse.com/menu?lang=ar    → arabe
```

Le middleware lit `?lang=`, le valide contre la liste des langues connues et
le transmet aux composants serveur. Un paramètre forgé ne peut donc produire
que l'une des trois langues prévues.

Le français garde l'URL nue : lui coller un paramètre créerait un doublon de la
page d'accueil.

Chaque page publie maintenant une table `hreflang` complète — les trois
langues plus `x-default` — et un `canonical`. Le sitemap annonce les mêmes
variantes en `xhtml:link`, et il calcule ses adresses **avec le même module**
que les métadonnées : la règle recopiée à deux endroits finit par diverger,
c'est déjà arrivé trois fois dans ce projet.

Vérifié sur le serveur : `?lang=en` sans aucun cookie renvoie bien « Order
now », `?lang=ar` renvoie l'arabe.

---

## Le second défaut : une page arabe qui se déclarait française

`<html lang="fr">` était écrit en dur dans la mise en page racine.

Un visiteur qui passait une vitrine en arabe recevait donc une page **écrite en
arabe et déclarée française**. Conséquences concrètes :

- un lecteur d'écran la prononce avec une voix française — inintelligible ;
- un moteur de recherche l'indexe comme du français ;
- le navigateur choisit ses polices de repli et sa césure sur la mauvaise
  langue.

Le sens de lecture, lui, était correct : `dir="rtl"` est bien posé par
l'enveloppe du site public. C'était donc à moitié fait, ce qui rendait le
défaut plus difficile à voir.

`<html>` porte désormais la langue et le sens réels. **Seules les vitrines
changent** : le tableau de bord reste en français, et la préférence qu'un
commerçant a choisie en visitant son propre site public ne déteint pas sur son
outil de travail. Le middleware distingue les deux.

| | avant | après |
|---|---|---|
| `/r/…` | `lang="fr" dir="ltr"` | `lang="fr" dir="ltr"` |
| `/r/…?lang=en` | `lang="fr"` ❌ | `lang="en" dir="ltr"` |
| `/r/…?lang=ar` | `lang="fr"` ❌ | `lang="ar" dir="rtl"` |
| tableau de bord, cookie arabe | `lang="fr"` | `lang="fr" dir="ltr"` ✓ |

---

## Le défaut que j'ai failli introduire

Faire primer l'URL sur le cookie **cassait le sélecteur de langue**.

Un visiteur arrivé par un lien `?lang=en` partagé, qui choisissait
« Français », posait bien le cookie — puis le paramètre de l'URL le
réimposait aussitôt en anglais. Le sélecteur aurait paru cassé, et le visiteur
aurait été enfermé dans une langue.

Je l'ai vu en relisant le composant avant de conclure, pas en le testant. Le
sélecteur met désormais l'URL et le cookie d'accord d'un même geste. Effet
secondaire heureux : **l'adresse devient partageable dans la langue affichée**.

Vérifié dans un navigateur, dans les trois sens : arrivée en anglais par un
lien, retour au français (le paramètre disparaît), passage à l'arabe (le
paramètre revient, et la page bascule en lecture inversée).

---

## Ce qui était déjà bon, et qui a été vérifié

| | état |
|---|---|
| sitemap par restaurant (accueil, menu, infos, chaque plat) | correct |
| `robots.txt` par vitrine, panier et commandes exclus | correct |
| démonstrations : `noindex`, sitemap vide | correct, dans les trois langues |
| données structurées `Restaurant` (adresse, horaires, position) | correct |
| titre, description, `og:*`, `twitter:*`, favicon par restaurant | correct |
| `Disallow: /r/` sur le domaine de la plateforme | correct — évite d'indexer deux fois la même vitrine |

Les métadonnées gagnent aussi `og:url`, `og:locale` conforme à la langue
réellement servie, et `og:locale:alternate` pour les deux autres. `og:locale`
annonçait `fr_FR` même sur une page arabe.

---

## Audit de sécurité de la phase

**Le paramètre de langue ne peut valoir que l'une des trois langues connues.**
`isLocale` le valide dans le middleware, puis `resolveLocale` le revalide. Une
valeur forgée retombe sur le français ; rien n'est interpolé sans contrôle.

**La langue ne participe à aucune décision d'autorisation.** Elle choisit un
dictionnaire, rien d'autre. Aucun contenu n'apparaît ni ne disparaît selon
elle.

**Les en-têtes ajoutés viennent du middleware, pas du client.** `x-locale` et
`x-public-site` sont **écrits** par le middleware sur chaque branche, et
`x-locale` est explicitement supprimé quand aucune langue valide n'est
demandée. Un client qui enverrait ces en-têtes lui-même ne peut donc pas les
faire survivre.

**Aucune donnée nouvelle n'est exposée.** Les URL publiées dans les `hreflang`
et le sitemap sont celles de pages déjà publiques. Les vitrines de
démonstration restent `noindex` et leur sitemap reste vide, dans toutes les
langues.

**Le `canonical` ne peut pas pointer ailleurs que sur la vitrine.** Il est
construit à partir de l'hôte de la requête et du slug résolu côté serveur,
jamais d'une valeur fournie par le visiteur.

---

## Tests

`tests/public-url.test.ts` — 18 tests purs sur les règles qui décident de ce
qui est indexé. Ces règles ne cassent aucun écran quand elles sont fausses :
elles font disparaître des pages des résultats de recherche, ou en font
indexer deux fois la même. C'est invisible pendant des mois, d'où les tests.

Notamment : le français garde l'URL nue, `x-default` suit la langue par
défaut, aucune adresse relative dans un `hreflang`, et **la même table produite
qu'on arrive par le domaine du restaurant ou par `/r/<slug>`**.

**29 fichiers, 317 tests, tous au vert.** `tsc`, `eslint src/ tests/` et le
build de production sans erreur.

---

## Ce que cette phase n'a pas couvert

**Le contenu traduit reste facultatif.** `hreflang` annonce une page anglaise ;
si le restaurateur n'a traduit ni ses plats ni sa description, cette page
affiche l'interface en anglais et le contenu en français. Ce n'est pas faux —
c'est ce que le restaurateur a saisi — mais un moteur peut juger la page
faible. Rien dans le tableau de bord n'indique combien de champs restent à
traduire ; c'est le point le plus utile à traiter ensuite.

**Les pages marketing de MagyaPro** restent monolingues. Le dictionnaire ne
couvre que les vitrines, et les traduire n'était pas demandé.

**Aucune mesure de performance.** Les Core Web Vitals pèsent sur le classement
et n'ont pas été mesurés. C'est un sujet distinct, qui demande un profil de
chargement réel.

**Le test humain.** Partagez sur WhatsApp le lien de votre vitrine suivi de
`?lang=en` : l'aperçu doit être en anglais. Puis ouvrez la vitrine, changez de
langue avec le sélecteur, et vérifiez que l'adresse de la page suit.
