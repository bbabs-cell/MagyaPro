# Publicité — « Le papier perdu »

Dossier de production complet d'une publicité de 45 secondes, en français,
jouée par un restaurateur. Tout est prêt sauf la génération elle-même, qui
attend des crédits Higgsfield.

> **État au 2 octobre 2026.** Compte Higgsfield connecté, **0 crédit**, plan
> `free`, essai MCP terminé le 21 septembre. Les recharges à l'unité sont
> désactivées sur cet espace de travail : le seul chemin est un abonnement
> (PLUS 1 000 crédits/mois, ULTRA 3 000). Tant que le solde est nul, aucun
> appel de génération ne peut aboutir.

---

## 1. Le parti pris

Le produit s'adresse à des commerçants qui ne se reconnaissent pas dans les
publicités de logiciels. Trois décisions en découlent, et elles contraignent
tout le reste.

**Un restaurateur, pas un influenceur.** Les deux étaient possibles. Un
restaurateur qui montre son propre outil est vérifiable par celui qui regarde :
il connaît ce décor, ces gestes, cette heure de service. Un influenceur vend
une recommandation, et une recommandation sans preuve n'a rien à offrir à un
produit que personne n'utilise encore.

**Un seul problème, montré en entier.** Quarante-cinq secondes ne suffisent pas
à présenter un produit à deux faces. On en montre une : la commande qui se
perd. Le reste du produit ne sera pas nommé — une publicité qui énumère n'est
pas regardée jusqu'au bout.

**Aucune preuve inventée.** `PRODUCT.md` l'impose et c'est aussi la seule
posture tenable : rien n'est encore vendu. Pas de nombre de clients, pas de
témoignage présenté comme réel, pas de chiffre d'affaires. Ce qui est montré à
l'écran est le produit tel qu'il tourne, capturé par `scripts/capture-pub.mjs`
sur la base de démonstration.

**Neutre sur toute la zone.** Ni drapeau, ni nom de ville, ni opérateur de
mobile money à l'image. Le marché est la zone franc CFA entière, et un décor
qui désigne un pays exclut les sept autres.

---

## 2. Le script

Durée cible **45 s**. Une seule voix. Le texte est écrit pour être dit, pas
pour être lu : phrases courtes, pas de subordonnée, pas de vocabulaire de
logiciel. Le compteur indique le début de chaque réplique.

| Temps | À l'image | Au son |
|---|---|---|
| **0:00** | Gros plan sur un carnet de commandes ouvert, écriture serrée, une page cornée. Lumière de fin de service. | — |
| **0:03** | Il relève la tête vers la caméra. | « Hier soir, j'ai perdu deux commandes. » |
| **0:06** | Il repose le carnet. | « Pas parce qu'on cuisine mal. Parce que le papier s'est perdu entre la salle et la cuisine. » |
| **0:12** | Il sort son téléphone. Insert plein cadre : `11-commandes-tel`. | « Maintenant la commande arrive là. » |
| **0:16** | Insert : la commande passe de « Nouvelle » à « En préparation » d'un geste du pouce. | « Le bon part en cuisine tout seul. Personne ne recopie rien. » |
| **0:21** | Insert : `13-carte-tel`, un plat basculé en épuisé. | « Le poisson est fini ? Je le marque épuisé. » |
| **0:25** | Insert : `02-menu-client-tel`, le plat a disparu de la carte publique. | « Il disparaît du site tout de suite. Je ne prends plus de commande que je ne peux pas servir. » |
| **0:31** | Il est au comptoir, un client devant lui. Insert : `12-prise-de-commande-tel`. | « Et quand on m'appelle, ou qu'on vient commander ici… » |
| **0:35** | Insert : la commande est saisie, le total s'affiche. | « …je la saisis moi-même. Elle compte comme les autres. » |
| **0:39** | Il relève la tête. Plan fixe. | « Un mois gratuit. Sans carte bancaire. » |
| **0:42** | Carton final : logo MagyaPro, la phrase, l'adresse. | — |

**Carton final (texte à l'écran, pas dit) :**

> **MagyaPro Restaurant**
> De la commande à la cuisine, sans un papier perdu.
> magyapro.com

### Ce que le script ne dit pas, et pourquoi

- **Aucun chiffre.** Pas de « +30 % de commandes », pas de « 2 minutes
  gagnées ». Ces nombres n'existent pas et les inventer ferait de la publicité
  une fausse déclaration.
- **Le mot « application » n'est jamais prononcé.** Le restaurateur parle de
  son métier, pas de l'outil. C'est ce qui distingue une publicité d'une
  démonstration.
- **« Un mois gratuit, sans carte bancaire »** est la seule promesse chiffrée,
  et elle est déjà publiée sur la page de présentation — donc vérifiable.

---

## 3. Le personnage

Un seul plan de référence sert à tous les plans parlés : c'est ce qui garantit
que le visage ne change pas d'un plan à l'autre. Il est fabriqué d'abord, puis
réemployé comme `start_image` partout.

**Description, à passer telle quelle :**

> Portrait photographique réaliste d'un restaurateur ouest-africain d'environ
> quarante-cinq ans, dans la salle de son restaurant en fin de service. Chemise
> de travail propre à manches retroussées, tablier sombre noué à la taille.
> Expression posée, fatiguée mais sûre d'elle. Lumière chaude de fin de
> journée, venant d'une fenêtre hors champ à gauche. Arrière-plan : tables en
> bois, chaises, un comptoir flou. Aucun drapeau, aucune enseigne lisible,
> aucun logo de marque. Rendu documentaire, pas publicitaire : grain léger,
> profondeur de champ naturelle, pas de retouche de peau.

**Ce qui est interdit dans le décor** — et doit figurer dans le prompt négatif
de chaque plan : drapeau, nom de ville, enseigne lisible, logo d'opérateur de
mobile money, billet de banque reconnaissable.

---

## 4. Les plans et le découpage technique

Neuf plans. Les plans parlés sont générés en vidéo ; les inserts d'écran sont
des **captures réelles du produit**, incrustées au montage — ils ne sont pas
générés, et c'est essentiel : une interface inventée par un modèle
ressemblerait au produit sans en être un, et chaque détail faux se verrait.

| # | Durée | Type | Source |
|---|---|---|---|
| 1 | 3 s | vidéo | carnet, gros plan |
| 2 | 6 s | vidéo parlée | réplique 0:03 |
| 3 | 6 s | vidéo parlée | réplique 0:06 |
| 4 | 4 s | vidéo + insert | `11-commandes-tel.png` |
| 5 | 5 s | vidéo + insert | commande → en préparation |
| 6 | 6 s | vidéo + insert | `13-carte-tel.png` |
| 7 | 6 s | vidéo + insert | `02-menu-client-tel.png` |
| 8 | 6 s | vidéo + insert | `12-prise-de-commande-tel.png` |
| 9 | 3 s | carton | montage |

Format **9:16** pour les réseaux. Une reprise **16:9** du même montage servira
la page de présentation si elle est demandée ; le script tient dans les deux,
les inserts étant déjà capturés aux deux largeurs.

---

## 5. Les captures produit

Elles ne sont **pas** versionnées. Déposer des PNG dans le dépôt les figerait :
au premier changement d'écran, la publicité montrerait une version qui n'existe
plus, et personne ne s'en apercevrait. Le générateur est versionné à leur
place, et se corrige quand un écran bouge.

```sh
npm run build && npm run start        # le serveur doit tourner
npx prisma db seed                    # comptes de démonstration
node scripts/capture-pub.mjs          # -> ./captures-pub/
```

28 fichiers, deux largeurs (téléphone 390×844, bureau 1440×900), nommés par ce
qu'ils prouvent et non par leur route. Le script signale en sortie tout écran
manquant plutôt que de produire une série incomplète en silence.

---

## 6. Le SDK officiel

Deux chemins mènent à Higgsfield, et ils ne servent pas la même chose.

Le **serveur MCP** sert à explorer : lister les modèles, lire un solde, choisir
un préréglage. Il est pratique en conversation et ne laisse aucune trace dans
le dépôt.

Le **SDK officiel** sert à produire : il est scriptable, reproductible, et
versionné avec le reste. C'est lui qui tirera les neuf plans du §4, dans le
même ordre à chaque fois.

### Installation, déjà faite

```sh
npm install --save-dev @higgsfield/client     # ^0.2.6
```

**En dépendance de développement, délibérément.** La contrainte fondatrice du
produit est qu'aucune IA payante n'entre dans ce qu'utilise un commerçant.
Fabriquer une publicité est un travail de studio, pas une fonctionnalité : le
paquet vit donc hors de `src/`, rien sous `src/` ne l'importe, et un
`npm ci --omit=dev` en production ne l'installe pas. La frontière doit rester
vérifiable d'un `grep`, pas seulement promise.

### Les identifiants

`HF_CREDENTIALS`, au format `identifiant:secret`, dans `.env.local` — ignoré
par Git depuis toujours (`.gitignore` ligne 10). `.env.example` documente la
variable sans valeur.

Le script valide la **forme** sans jamais afficher la valeur : un message
d'erreur qui citerait l'identifiant, même tronqué, finirait dans un journal de
terminal ou une sortie d'intégration continue. Il n'est pas non plus passé en
argument de ligne de commande, qu'un `ps` rendrait visible.

### L'exemple

`scripts/higgsfield/index.ts`, lancé par :

```sh
npm run higgsfield:exemple
```

Il appelle `subscribe` sur `bytedance/seedance-2.5/text-to-video` avec
l'invite « A cinematic scene at sunset », 5 secondes, 720p, 16:9, puis attend
la fin et affiche l'adresse de la vidéo.

Le chargement de `.env.local` passe par `node --env-file-if-exists`, intégré à
Node : ajouter `dotenv` pour cela aurait été une dépendance de plus pour une
fonction que le runtime possède déjà.

**Une requête terminée n'est pas une requête réussie.** Le client déclare cinq
statuts — `queued`, `in_progress`, `completed`, `failed`, `nsfw` — et expose
par ailleurs une adresse d'annulation, donc un statut d'annulation peut
apparaître sans figurer dans ce type. Chacun est traité nommément, tout statut
inconnu est un échec, et un `completed` sans fichier joint en est un aussi.
La seule issue qui vaut succès est une vidéo réellement présente ; dans tous
les autres cas le script sort en code 1 sans rien annoncer.

### État de la vérification

Vérifié par exécution réelle, le 2 octobre 2026 :

| | |
|---|---|
| Paquet installé, client configuré | ✅ |
| Identifiants chargés et acceptés par l'API | ✅ |
| Modèle et paramètres atteignant le service | ✅ |
| Chemins d'erreur : sortie en code 1, sans succès annoncé | ✅ |
| **Génération menée à son terme, URL de vidéo rendue** | ✅ |

Le fichier produit a été sondé, pas seulement annoncé : `1280×720` (donc bien
720p), 16:9, 5,06 s, H.264 avec piste audio AAC, 4,5 Mo. Chaque paramètre
demandé se retrouve dans la sortie.

Une remarque sur la fiabilité du transport : la première tentative s'est
interrompue sur `Client network socket disconnected before secure TLS
connection was established`. Le proxy ne rapportait aucune panne, et la
tentative suivante a abouti sans rien changer. L'attente d'une génération est
une connexion longue ; une interruption passagère doit être relancée, pas
diagnostiquée.

### Deux comptes Higgsfield, et c'est à savoir

**La clé d'API et la connexion MCP ne désignent pas le même compte.** Après la
génération réussie, le solde lu par MCP affichait toujours zéro crédit en plan
`free`, et son journal de transactions s'arrêtait au 21 septembre — ni le
rechargement ni la dépense du jour n'y figurent.

Conséquence pratique : **le solde lu par MCP ne dit rien de ce que le SDK peut
dépenser.** Pour suivre la consommation de la production publicitaire, c'est la
console du compte portant la clé d'API qui fait foi.

Un repère de coût, relevé dans le journal MCP : une génération Seedance 2.5 y
a coûté **65 crédits**. Le prix dépend de la durée et de la résolution, donc ce
nombre ne se multiplie pas tel quel par neuf plans — mais il situe l'ordre de
grandeur bien mieux que l'estimation de 405 portée au §8.

---

## 7. Les appels Higgsfield, prêts à tirer

Dans cet ordre. Chaque étape dépend de la précédente.

### Étape 1 — le visage de référence

```
generate_image
  model:  soul_2                     // Higgsfield Soul 2.0 — UGC réaliste
  prompt: <la description du §3>
  aspect_ratio: 9:16
  quality: 2k
```

Garder l'identifiant de média du résultat : il sert de `start_image` à tous les
plans parlés. C'est lui, et lui seul, qui tient la continuité du visage.

### Étape 2 — les plans parlés

Un appel par plan, en reprenant la même image de départ.

```
generate_video
  model:  seedance_2_5               // ByteDance Seedance 2.5
  mode:   omni_reference             // conserve l'identité du personnage
  medias: [{ role: start_image, id: <média de l'étape 1> }]
  duration: <durée du plan, §4>
  resolution: 1080p
  generate_audio: true
  aspect_ratio: 9:16
  prompt: <décor + jeu + la réplique entre guillemets, en français>
```

`generate_audio: true` produit la voix avec l'image. Si le résultat ne convient
pas, la solution de repli est de générer la voix séparément avec
`elevenlabs_v4_turbo` (une seule voix pour tous les plans — c'est ce que la
cohérence exige) et de la synchroniser au montage.

### Étape 3 — attendre, puis récupérer

```
jobs_wait        → une seule attente pour tous les plans lancés
show_generation_by_ids → un seul appel pour tout récupérer
```

### Étape 4 — le montage

Les inserts d'écran et le carton final se montent hors Higgsfield. `ffmpeg` est
installé dans l'environnement de travail.

---

## 8. Le coût

**À faire chiffrer avant de lancer quoi que ce soit.** L'estimation portée au
dossier précédent était d'environ 405 crédits pour une publicité de 45
secondes — ordre de grandeur, pas un devis : le prix dépend du modèle, de la
résolution et de la durée réellement demandée, et ces grilles bougent.

Le geste à faire en premier, dès que le compte est approvisionné, est donc un
**devis** : les outils Higgsfield en proposent un qui ne consomme rien. Si
l'ordre de grandeur se confirme, PLUS (1 000 crédits/mois) couvre environ deux
publicités par mois, ULTRA (3 000) environ sept.

Une économie à connaître : **relancer un seul plan coûte un seul plan.** En cas
de plan raté, ne pas régénérer la série — c'est la dépense la plus fréquente et
la plus inutile.

---

## 9. Ce qui reste à décider

- **La seconde publicité, côté Boutique.** Même structure, autre personne
  (décision déjà prise : une personne différente par publicité), autre argument
  — la vente au carton comme à l'unité, et l'encaissement hors réseau. Le
  script n'est pas écrit : une seule publicité a été demandée pour commencer.
- **L'adresse du carton final.** `magyapro.com` est employée ici par défaut ;
  elle doit être confirmée, comme l'adresse de contact des pages légales.
- **Le format de la reprise.** 9:16 est produit d'office. Reste à décider si la
  page de présentation reçoit une version 16:9.
