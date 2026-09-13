# Super Admin — phase 16

Le §23-27 demande deux univers de premier niveau, Restaurants et Boutiques.
C'était le seul point relevé par l'audit initial. En le traitant, **trois
défauts sur les chiffres** sont apparus, tous du même genre : des nombres faux
qui ressemblaient exactement à des nombres justes.

Aucune migration n'a été nécessaire.

---

## Le défaut principal : des totaux qui affirmaient une devise

La critique I1, ouverte depuis la phase 1 et reportée à cette phase, disait que
le « volume traité » additionnait les ventes de tous les commerces sans
distinguer leur devise.

C'était en dessous de la réalité. Le code était :

```
formatMoney(metrics.grossVolume, 'XOF')
```

Le nombre ne se contentait pas d'être ambigu : il **affirmait une devise qu'il
n'avait pas**. Un franc CFA d'Afrique centrale additionné à un franc CFA
d'Afrique de l'Ouest était affiché comme de l'ouest-africain. Même chose sur
les deux écrans de statistiques et sur les graphiques mensuels.

Le vocabulaire pour bien faire existait déjà — `sumByCurrency`,
`primaryCurrency`, `amountIn`, écrits pour le correctif C1 — et le MRR, dans le
même fichier, était déjà tenu par devise. Le volume était le seul resté à
l'écart.

### Ce qui change

Les volumes sont tenus par devise de bout en bout : `grossVolumeByCurrency`
côté cartes, et un montant par devise dans chaque seau mensuel côté graphiques.

Un graphique ne sait tracer qu'une série. Il trace donc la devise dominante et
**énonce les autres sous le graphique** au lieu de les y fondre. C'est le seul
choix honnête : additionner reste faux, et masquer les autres devises serait
pire encore.

Côté Boutique, `Sale` ne porte pas de colonne de devise — c'est celle de sa
boutique. Les ventes sont donc regroupées par boutique puis rattachées à leur
devise, plutôt qu'additionnées à l'aveugle.

### Trouvé en chemin

**Le graphique de volume de la vue consolidée était libellé avec la mauvaise
devise** — celle du revenu d'abonnement de MagyaPro, sans aucun rapport avec
les montants tracés, qui sont l'argent des caisses des clients. Les deux
n'avaient aucune raison de coïncider.

---

## Le second défaut : une alerte qui réclamait d'agir sur des comptes fictifs

`analytics.ts` exclut les vitrines de démonstration partout — treize fois.
`platform-revenue.ts` ne le faisait **nulle part**.

Ce n'était pas seulement une incohérence de principe. Le jeu de démonstration
crée pour chaque vitrine un abonnement actif valable trente jours. Passé ce
délai, la vue d'ensemble affichait :

> N abonnements actifs dont la période est dépassée

en comptant des comptes qui n'appartiennent à personne. **Une alerte qui
demande d'agir sur des données fictives est pire qu'une alerte absente** : elle
apprend à ignorer les alertes.

Les six lectures globales de la recette excluent désormais les démonstrations.
Les deux lectures restantes du fichier — les paiements d'un client donné sur sa
fiche — sont bornées à un identifiant et n'ont rien à filtrer : ouvrir la fiche
d'une démonstration doit bien montrer ses paiements.

En ajoutant ce filtre, j'ai créé un désaccord que j'ai dû corriger dans la
foulée : le **compteur** de paiements en attente excluait les démonstrations,
la **liste** de la page de renouvellement non. Les deux portent maintenant le
même filtre.

---

## Les deux univers

La navigation avait été regroupée en cinq sections par type de question —
pilotage, clients, revenus, statistiques, plateforme. C'était mieux qu'une
liste à plat, mais cela **éparpillait chaque produit sur trois sections** :
répondre à « comment va la Boutique ? » demandait de visiter Clients, puis
Revenus, puis Statistiques.

Le §23-27 a raison sur l'unité de regroupement : le Super Admin pense par
produit.

| section | entrées |
|---|---|
| **Plateforme** | Vue d'ensemble, Vue consolidée, Journal |
| **Restaurant** | Comptes, Abonnements, Statistiques, Templates |
| **Boutique** | Comptes, Abonnements, Statistiques |
| **Commun** | Utilisateurs, Plans, Annonces, Notifications, Images |

Restent hors des deux univers ce qui est réellement commun : la vue d'ensemble
et la vue consolidée, qui comparent les deux produits ; les utilisateurs, qui
peuvent appartenir aux deux ; les plans, qui portent déjà leur propre onglet
Restaurant/Boutique ; et les réglages de la plateforme elle-même.

« Analytics » disparaît au passage : c'était le seul anglicisme de la
navigation, et le reste du produit dit « Statistiques ».

### Un défaut introduit par ce changement, et corrigé

Une fois l'entrée placée sous son univers, son libellé n'a plus à répéter le
produit : « Comptes » plutôt que « Restaurants ». Mais l'intertitre n'est
qu'un `<p>` visuel — **il n'est pas lu dans une liste de liens**. Un
utilisateur de lecteur d'écran aurait entendu « Comptes » deux fois,
« Abonnements » deux fois et « Statistiques » trois fois, sans rien pour les
distinguer.

Les liens raccourcis portent donc un nom accessible qui reprend l'univers —
« Restaurant — Comptes » — tout en gardant le texte visible inchangé, comme
l'exige le critère « intitulé dans le nom ».

---

## Audit de sécurité de la phase

**Aucun contrôle d'accès n'est touché.** Le garde du layout et les
vérifications de rôle des routes `/api/admin/*` sont inchangés. La
réorganisation ne déplace aucune page : les URL sont les mêmes, seul leur
regroupement visuel change. Une entrée retirée de la navigation resterait
d'ailleurs accessible — c'est le garde qui protège, pas le menu.

**Les filtres ajoutés restreignent, ils n'élargissent jamais.** Chaque `where`
gagne une condition ; aucune n'en perd. Un Super Admin ne voit donc rien de
plus qu'avant, et une donnée de démonstration ne peut pas être prise pour une
donnée réelle.

**Aucune donnée nouvelle n'est lue.** Le regroupement par devise porte sur des
colonnes déjà chargées ; côté Boutique, une lecture supplémentaire remonte la
devise des boutiques concernées, bornée aux identifiants déjà cités par
l'agrégation.

**Les montants restent des entiers.** Aucune conversion entre devises n'est
faite nulle part — c'est précisément le point : le produit n'a pas de taux de
change et n'a pas à en inventer un.

---

## Tests

`tests/platform-figures.test.ts` — 3 tests qui lisent les sources, sur le
modèle de `reactivity.test.ts`. Ces deux défauts sont invisibles à l'écran et
sont déjà revenus une fois chacun :

- aucun écran du Super Admin n'affiche un montant dans une devise écrite en
  dur ;
- toutes les lectures globales de la recette excluent les démonstrations ;
- les deux modules de statistiques portent leur filtre de démonstration.

`tests/money.test.ts` gagne 4 tests sur `mergeByCurrency`, dont un qui vérifie
qu'elle ne modifie pas les répartitions qu'on lui donne — les seaux mensuels
servent d'abord à trouver la devise dominante, puis à tracer le graphique.

**J'ai vérifié que ces gardes mordent** en plantant chacune des deux
violations. La première version du garde sur les devises **ne les attrapait
pas** : son expression régulière ne pouvait pas franchir la parenthèse d'un
argument imbriqué. Elle aurait laissé passer exactement le genre d'écriture
qu'elle prétendait interdire. Corrigée, puis revérifiée.

**Suites pures : 18 fichiers, 173 tests, tous au vert.** Les deux échecs
restants sont les tests de limitation de débit, qui demandent PostgreSQL.

---

## Ce que cette phase n'a pas couvert

**L'historique du MRR.** Aucun instantané mensuel n'est conservé : seule sa
valeur actuelle est calculable. Un graphique d'évolution du MRR demanderait une
table d'instantanés et une tâche planifiée — c'est un travail de fond, pas un
correctif.

**Les écrans du Super Admin n'utilisent pas `useServerMutation`**, la primitive
écrite en phase 4. Ils ont leurs propres `pending` / `error` locaux. Ils
fonctionnent, et rien n'y est faux ; c'est une dette de cohérence, pas un
défaut.

**Le test humain.** Ouvrez la vue d'ensemble et les deux écrans de
statistiques. Les volumes doivent porter un code de devise explicite. Si votre
base contient des vitrines de démonstration créées il y a plus de trente jours,
l'alerte « abonnements dont la période est dépassée » doit avoir baissé — ou
disparu.
