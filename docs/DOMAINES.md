# Domaines personnalisés — phase 12

Le §19 demande un parcours étape par étape qu'un restaurateur puisse suivre
seul. Il en manquait la moitié — et l'audit a découvert que la fonctionnalité
**ne va pas jusqu'au bout**, ce qui est le vrai sujet de cette phase.

---

## 🔴 Ce qu'il faut que vous sachiez avant de vendre cette fonctionnalité

**Un domaine « vérifié » ne rend pas le site joignable.**

Le produit fait correctement la première moitié du travail : il demande un
enregistrement TXT, le lit, et confirme que le restaurateur possède bien
l'adresse. Cette preuve est solide — seul quelqu'un qui contrôle la zone DNS
peut créer cet enregistrement.

Mais il manque la dernière étape : **l'adresse doit être déclarée auprès de
l'hébergeur**. Sans cela, un visiteur qui tape `restaurant-x.com` tombe sur une
erreur de l'hébergeur, pas sur le restaurant — et aucun certificat de sécurité
n'est émis, donc pas de cadenas `https`.

Rien dans le code ne fait cette déclaration. Pire, l'écran affirmait le
contraire :

> Le certificat TLS est émis automatiquement une fois le domaine vérifié.

C'était faux. Un restaurateur pouvait suivre toutes les instructions, voir
« Vérifié », et se retrouver avec un site inaccessible sans comprendre
pourquoi.

### Ce que j'ai fait, et ce que je n'ai pas fait

**Fait** — dire la vérité et rendre la suite traitable :

- l'écran du restaurateur annonce qu'une dernière étape reste, faite par vous,
  et qu'il n'a rien à faire de plus ;
- la vue d'ensemble de l'administration liste **les domaines vérifiés en
  attente de déclaration**, avec le restaurant et la date. Sans cette liste, la
  demande du restaurateur n'aurait eu aucun endroit où atterrir ;
- le commentaire trompeur dans le code est corrigé.

**Pas fait** — l'automatisation. Déclarer un domaine chez l'hébergeur se fait
par son API, ce qui demande un jeton, l'identifiant du projet, et un compte
actif. Le vôtre n'est pas encore ouvert. Écrire cette intégration maintenant
reviendrait à livrer du code que personne n'a jamais exécuté contre un vrai
compte, sur le chemin le plus visible du produit. **C'est une décision qui vous
revient**, et je la prendrai avec vous une fois l'hébergement en place.

En attendant, la fonctionnalité est utilisable et honnête : le restaurateur
fait sa part, vous faites la vôtre, et l'écran d'administration vous dit quand.

---

## Le parcours du §19

### Ce qui manquait

L'écran s'appelait « Domaines » et présentait les deux enregistrements DNS sous
forme de deux phrases dans un pavé gris. Aucun bouton pour copier.

**C'est le manque le plus coûteux.** Un jeton de vérification fait une
trentaine de caractères sans structure. Recopié à la main dans la console d'un
bureau d'enregistrement, il sera faux une fois sur trois — et l'erreur ne se
voit qu'après une propagation qui dure des heures.

### Ce qu'il y a maintenant

La section s'appelle **« Mon domaine »**, comme le demande le §19, et le
parcours est numéroté :

1. **Ouvrez le site où vous avez acheté votre domaine** — avec les trois noms
   que porte la rubrique selon les revendeurs : « DNS », « Zone DNS »,
   « Enregistrements » ;
2. **Ajoutez un enregistrement TXT** — *il prouve que le domaine est à vous* ;
3. **Ajoutez un enregistrement CNAME** — *il amène les visiteurs sur votre
   site* ;
4. **Revenez ici et appuyez sur « Vérifier »**.

Chaque valeur a son bouton **Copier**. Le presse-papiers peut être refusé selon
le navigateur ; le bouton le dit alors, plutôt que de prétendre avoir réussi.

Les deux enregistrements **disent ce qu'ils font**. Quelqu'un qui ne sait pas
lequel sert à quoi ne saura pas non plus lequel corriger quand ça ne marche
pas.

### Les messages

Le §19 demande des phrases, pas des codes d'état. Les badges
« Vérifié / En attente / Échec » sont remplacés par :

> **Votre domaine est vérifié.**
>
> **Nous attendons encore la configuration DNS.**

Et le bouton devient **« Réessayer »** après un échec, plutôt que de répéter
« Vérifier ».

L'étape 4 dit aussi ce qu'un restaurateur inquiet a besoin d'entendre : ne rien
trouver n'est pas forcément une erreur, un changement DNS met de quelques
minutes à quelques heures à se propager.

### Une porte d'entrée pour ceux qui n'ont pas de domaine

Quand aucun domaine personnalisé n'est enregistré, une ligne discrète explique
qu'un nom de domaine s'achète chez un revendeur, pour l'ordre de grandeur d'une
dizaine de milliers de francs par an. C'était la première question sans réponse
sur cet écran.

---

## Un bouton « Copier » partagé

Il en existait déjà un, écrit à la main dans l'écran de salle pour les liens de
QR code. Le nouveau composant est commun aux deux : il gère l'état « copié »,
le retour à l'état normal après deux secondes, et le cas du presse-papiers
refusé — qu'une copie manuelle avait tendance à oublier.

---

## Audit de sécurité de la phase

**La preuve de propriété est inchangée.** Toujours un enregistrement TXT lu
côté serveur, jamais une requête HTTP vers le domaine — qui ne prouverait rien,
n'importe qui pouvant faire pointer un CNAME vers n'importe où.

**Les contrôles d'unicité et de réservation sont inchangés.** Un domaine ne
peut appartenir qu'à un restaurant, et les adresses de la plateforme ne peuvent
pas être revendiquées.

**La nouvelle liste d'administration n'est visible que du Super Admin** : elle
est rendue par une page déjà protégée par `requireSuperAdmin`, et n'ajoute
aucune route.

**Le bouton « Copier » n'écrit rien et ne lit rien d'autre** que la valeur
qu'on lui passe, déjà affichée à l'écran juste à côté.

**Le panneau passe par `useServerMutation`** comme le reste du produit : les
erreurs de l'hébergeur ou du DNS s'affichent dans le même bandeau que partout
ailleurs, et le bouton n'annonce plus la fin avant que l'écran soit à jour.

---

## Ce que cette phase n'a pas couvert

**L'automatisation de la déclaration chez l'hébergeur** — voir plus haut. C'est
la décision qui vous revient.

**Le test humain.** Il demande un vrai domaine : en acheter un, suivre les
quatre étapes, et voir si elles se suivent sans vous. C'est le seul test qui
compte pour cette phase, et je ne peux pas le faire.
