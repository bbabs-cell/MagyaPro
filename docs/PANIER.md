# Panier et commande — phase 7

Le §16 décrit précisément le défaut et le remède attendu. Cette phase les
applique, et corrige au passage un défaut plus grave trouvé sur le chemin.

---

## 1. Le formulaire était caché derrière un clic

Le tunnel se faisait en deux temps. Le client voyait son panier, appuyait sur
« Continuer », et **découvrait alors** ce qu'on allait lui demander. Trois
champs ou quinze ? Impossible de le savoir avant de s'engager.

C'est exactement ce que le §16 interdit : *« Ne pas obliger l'utilisateur à
cliquer sur "Commander" simplement pour découvrir le formulaire. »*

Tout est désormais affiché d'emblée, en deux colonnes :

| | Contenu |
|---|---|
| **Gauche** | les articles, les quantités, les prix, le mode de service, le total |
| **Droite** | les coordonnées, le moyen de paiement, le bouton de validation |

Sur téléphone les colonnes s'empilent, et l'ordre obtenu répond aux cinq
questions du §16 l'une après l'autre :

1. ce que je commande — les articles ;
2. combien cela coûte — le récapitulatif ;
3. où je serai livré — le mode de service et la zone ;
4. comment renseigner mes informations — le formulaire ;
5. comment confirmer — le bouton, **qui porte le montant**.

Le montant est repris sur le bouton parce que sur téléphone le récapitulatif se
retrouve loin au-dessus : personne ne valide un paiement sans revoir la somme
au moment d'appuyer.

### Deux détails techniques qui comptent

**Pas de colonne collante.** La version précédente rendait le récapitulatif
`sticky`. La colonne de droite contient maintenant tout le formulaire et
dépasse souvent la hauteur de l'écran — or une colonne collante plus haute que
la fenêtre garde son bas hors de portée, et le bas, c'est le bouton de
validation. Les deux colonnes défilent normalement.

**Le titre nomme la section.** Le récapitulatif portait un `aria-label`
reprenant le mot déjà écrit dans son titre, que les lecteurs d'écran annonçaient
deux fois. Il est maintenant désigné par son titre (`aria-labelledby`).

La clé de traduction « Continuer », devenue sans objet, a été retirée des trois
langues.

---

## 2. Le défaut trouvé en chemin : la commande n'était pas traduite

La vitrine se traduit en français, en anglais et en arabe. Deux composants du
parcours de commande ne passaient pas par les dictionnaires et écrivaient leur
texte en français dans le code :

- **le bouton d'ajout rapide**, présent sur *chaque* carte de plat —
  « + Ajouter », « Ajouté ✓ », et les libellés lus par les lecteurs d'écran ;
- **la fiche d'un plat** — le formulaire de choix de taille, d'options et de
  quantité. Il ne contenait **aucun** appel au dictionnaire : « Taille »,
  « Quantité », « Facultatif », « Ajouter au panier », « Commander », les
  messages de validation, le message d'indisponibilité.

Un visiteur qui passait le site en anglais ou en arabe voyait donc la carte
traduite, les menus traduits, le panier traduit — et du français sur les seuls
écrans où l'on commande vraiment.

Dix-neuf clés ont été ajoutées par langue — dix-huit sur la fiche d'un plat,
une pour le panier — soit cinquante-sept en tout.

### Un test pour que cela ne recommence pas

`tests/dictionary.test.ts` compare les **chemins de clés** des trois langues
(jamais les valeurs — deux langues ne doivent surtout pas dire la même chose)
et vérifie qu'aucune valeur n'est vide.

Le typage ne suffisait pas : le type `Dictionary` est dérivé de la version
française, si bien qu'une clé oubliée en arabe ne se signale qu'à l'endroit
précis où le code la lit. À l'exécution, un libellé de bouton vaudrait
`undefined` et le client verrait un bouton vide au moment de payer. Le test a
été vérifié en retirant volontairement une clé : il échoue et la nomme.

---

## Audit de sécurité de la phase

Vérifié, aucune faille introduite.

**Aucun changement dans ce qui est envoyé au serveur.** La commande part avec
exactement les mêmes champs qu'avant ; seule la disposition à l'écran change.
Le contrôle du prix reste intégralement côté serveur — le devis est redemandé à
chaque modification, l'estimation locale ne sert qu'à éviter une case vide
pendant l'appel, et le total réel est celui que le serveur calcule à la
création.

**Les règles de validation ne sont pas relâchées.** Le contrôle des options
obligatoires reste un doublon d'affichage : le serveur revérifie les mêmes
règles, comme avant.

**L'ordre des opérations à la validation est inchangé** : le panier n'est vidé
et les coordonnées ne sont retenues qu'après acceptation par le serveur. Un
refus laisse la commande intacte.

**Les traductions n'introduisent aucune interpolation dangereuse.** Les
fonctions ajoutées reçoivent un nom de plat ou un nom de groupe d'options et
les insèrent dans du texte rendu par React, qui échappe.

---

## Ce que cette phase n'a pas couvert

**Les sept modèles de vitrine** (accueil des restaurants) écrivent aussi leur
texte en français dans le code — « Commander maintenant », « Notre menu »,
« Notre histoire ». C'est le même défaut que celui corrigé ici, mais il porte
sur des pages de présentation et non sur le parcours de commande, et il touche
sept fichiers volumineux. Il relève de la **phase 14, Templates Restaurant**.

**Le paiement lui-même** — dépôt de preuve, redirection Mobile Money — relève
du §33 et n'a pas été touché.
