# Problèmes critiques — phase 3

Vérification dans le code des points signalés par l'audit et la cartographie.
**Lecture seule.** Chaque constat a été ouvert et lu, aucun n'est supposé.

---

## 🔴 Critique

### C1. Le total consolidé multi-boutiques est faux dès que deux devises coexistent

`src/app/boutique/dashboard/toutes-boutiques/page.tsx`

Le total du chiffre d'affaires additionne les recettes de toutes les boutiques
d'un propriétaire **sans regarder leur devise**, puis l'affiche dans la devise
de **la première boutique de la liste**.

Un propriétaire ayant une boutique à Abidjan et une à Douala verrait donc un
nombre qui additionne des francs CFA d'Afrique de l'Ouest et d'Afrique
centrale, étiqueté avec l'une ou l'autre selon l'ordre d'affichage.

Deux raisons d'en faire une priorité haute :

- **c'est de l'argent affiché faux, sans aucun signal.** Un total visiblement
  absent vaut mieux qu'un total silencieusement inexact ;
- **cela touche la fonctionnalité vendue à +75 %.** Le multi-boutiques est un
  argument commercial, et la zone visée contient deux francs CFA distincts —
  la vitrine de démonstration de Douala est déjà en francs d'Afrique centrale.

Aujourd'hui, aucun propriétaire réel n'a de boutique dans les deux zones : le
chiffre n'est donc pas encore faux. Il le deviendra au premier cas, sans que
rien ne prévienne.

**Corrigé.** Le cumul ne totalise plus qu'à devise égale : une ligne par
monnaie, la plus lourde en tête, et une phrase sous la carte quand plusieurs
coexistent. Tant qu'une seule devise circule — le cas de tous les commerçants
actuels — l'écran est identique à avant.

La règle elle-même a été remontée dans `src/lib/money.ts`
(`sumByCurrency`, `primaryCurrency`, `amountIn`, `hasSeveralCurrencies`) : elle
n'appartenait pas au module de recette de la plateforme, où elle avait été
écrite, mais à l'endroit qui porte déjà tout ce qui touche aux montants. Elle
est désormais disponible pour tout total qui traverse plusieurs commerces, et
couverte par six tests.

### C2. Faille Next.js — **corrigée en phase 0**

Exécution de code à distance par l'optimiseur d'images sur fichier AVIF.
Version passée de 15.5.23 à 15.5.25. Plus aucune vulnérabilité critique.

---

## 🟠 Important

### I1. Les volumes de la plateforme mélangent aussi les devises

`boutique/platform-analytics.ts`, `analytics.ts`

Même défaut que C1, côté Super Admin : le « volume traité » additionne les
ventes de tous les commerces sans distinguer leur devise.

Classé un cran plus bas parce que les vitrines de démonstration sont exclues de
ces calculs et qu'aucun commerce réel n'est hors zone ouest-africaine. Le
chiffre est donc exact aujourd'hui. Il cessera de l'être le jour d'une
inscription camerounaise.

**Toujours ouvert** après le correctif de C1. Contrairement à ce que cette
page annonçait, il ne suit pas du même changement : les briques nécessaires
existent maintenant, mais le graphique de volume ne sait afficher qu'une seule
série de nombres. Séparer les devises demande de toucher aussi les composants
de graphique du Super Admin, ce qui dépasse un correctif ponctuel. À traiter
avec les écrans d'analyse.

### I2. Un cuisinier voit trop de choses

Relevé en phase 2, confirmé : l'écran cuisine exige la permission de changer le
statut d'une commande, qu'un employé possède — avec sept autres. Un cuisinier
en rôle « Employé » accède au fichier clients, aux réservations, aux tables et
aux livraisons.

Traité en phase 9, sur le modèle du rôle Livreur qui, lui, est correctement
cloisonné.

---

## Vérifié, et sain

Ces points ont été ouverts et lus. Ils ne demandent aucun travail.

**Aucun trou d'isolation entre commerces.** Les six requêtes qui chargent une
ressource par son seul identifiant ont été examinées une par une : quatre
portent sur des ressources de plateforme sans propriétaire (plans, annonces),
une reçoit un identifiant déjà issu de la session, et les deux dernières —
l'approbation et le refus d'un paiement d'abonnement — ne sont appelées que par
le Super Admin, qui agit légitimement sur tous les commerces. Ces deux-là
refusent en outre de traiter deux fois la même demande.

**Les messages d'erreur sont déjà conformes au §32.** La couche de transport
distingue une panne réseau d'une erreur serveur, parce que l'action à mener
n'est pas la même pour l'utilisateur. Le serveur, lui, ne renvoie jamais le
détail d'une exception : il répond « Une erreur inattendue s'est produite.
Réessayez dans un instant. » et envoie requêtes SQL, chemins de fichiers et
structure interne dans les journaux. Aucun « Error 500 » ne peut atteindre un
commerçant.

**Les routes sensibles sans garde d'authentification sont protégées
autrement** — secret partagé pour la tâche planifiée, signature HMAC à temps
constant pour le webhook Wave, appartenance vérifiée avant tout changement de
commerce actif.

---

## Ce que cette phase n'a pas couvert

Les défauts visibles seulement à l'écran : un bouton mal placé, un texte
incompréhensible, une lenteur ressentie. Ils relèvent des phases 4 à 6 et du
test humain.

---

## Suite donnée

C1 a été corrigé immédiatement, sans attendre son tour dans les phases :
il s'agissait d'argent affiché faux.

I1 reste ouvert et rejoint le lot des écrans d'analyse — voir ci-dessus.
