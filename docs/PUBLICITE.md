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

## 6. Les appels Higgsfield, prêts à tirer

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

## 7. Le coût

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

## 8. Ce qui reste à décider

- **La seconde publicité, côté Boutique.** Même structure, autre personne
  (décision déjà prise : une personne différente par publicité), autre argument
  — la vente au carton comme à l'unité, et l'encaissement hors réseau. Le
  script n'est pas écrit : une seule publicité a été demandée pour commencer.
- **L'adresse du carton final.** `magyapro.com` est employée ici par défaut ;
  elle doit être confirmée, comme l'adresse de contact des pages légales.
- **Le format de la reprise.** 9:16 est produit d'office. Reste à décider si la
  page de présentation reçoit une version 16:9.
