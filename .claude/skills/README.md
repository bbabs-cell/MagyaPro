# Compétences de projet

Les dossiers présents ici sont chargés automatiquement par Claude Code dès qu'une
session s'ouvre sur ce dépôt — y compris les sessions distantes, qui n'ont accès à
rien d'autre que ce qui est versionné. C'est la raison pour laquelle le fichier est
copié dans le dépôt plutôt que laissé dans l'installation locale d'une machine.

## impeccable

- Source : https://github.com/pbakaus/impeccable (Apache 2.0, © Paul Bakaus)
- Version : 4.3.1, commit `cb56ed6` du 11/09/2026
- Installé à la main : `/plugin marketplace add` n'existe pas dans les sessions
  distantes, et un greffon non versionné ne survivrait de toute façon pas à la
  fin du conteneur.

Copie de `plugin/skills/impeccable/`, sans modification. Vingt-trois commandes
de conception (`shape`, `critique`, `audit`, `polish`, `typeset`, `layout`…)
derrière une seule entrée `/impeccable`.

**Le moteur est un binaire compilé, téléchargé au premier usage.** Le lanceur
`scripts/impeccable` cherche un binaire à côté de lui, puis dans
`~/.impeccable/`, puis le récupère depuis le canal de publication public en
vérifiant son empreinte. Le binaire n'est donc pas versionné ici, et chaque
nouvelle session distante le retéléchargera — le cache vit dans le conteneur,
qui est effacé à la fin de la session. Sans réseau, la compétence continue de
fonctionner en mode dégradé : elle le prévoit explicitement et se rabat sur la
lecture directe du projet, en perdant seulement les détecteurs mécaniques.

**Les déclencheurs automatiques n'ont volontairement pas été installés.** Le
greffon d'origine fournit des `hooks` qui exécutent ce binaire après *chaque*
écriture de fichier et à la fin de chaque tour. Lancer automatiquement un
binaire téléchargé à chaque modification est une décision qui se prend
sciemment, pas un effet de bord d'une installation. Le détecteur se lance donc
à la demande :

```
.claude/skills/impeccable/scripts/impeccable detect --json <fichiers>
```

Les deux autres variantes du dépôt (`cursor-plugin/`, `skill/`) sont les mêmes
fichiers empaquetés pour d'autres outils ; une seule copie suffit.

Ce que la compétence attend et qui n'existe pas encore : un `PRODUCT.md` à la
racine, qu'elle sait produire elle-même via `/impeccable init`. Tant qu'il est
absent, les commandes de refonte complète se bloquent volontairement ; les
retouches ciblées, elles, s'appuient sur le code existant et passent.

## design-taste-frontend

- Source : https://github.com/Leonxlnx/taste-skill (MIT, © Leonxlnx)
- Version : v2 expérimentale, commit `ccbc156` du 24/08/2026
- Installé par : `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`

L'installateur dépose les fichiers dans `.agents/skills/` puis crée un lien
symbolique depuis `.claude/skills/`. Le lien a été remplacé par une copie réelle :
un dépôt cloné sous Windows sans les liens symboliques activés récupérerait
autrement un fichier texte contenant un chemin, et la compétence ne se chargerait
pas. Le contenu est identique à l'original, sans modification.

Portée : pages de présentation, portfolios, refontes visuelles. La compétence
indique elle-même qu'elle ne couvre pas les tableaux de bord ni les écrans
métier — la caisse, les analyses et l'administration restent hors de son domaine.

Pour la mettre à jour, relancer la commande d'installation ci-dessus puis recopier
`.agents/skills/design-taste-frontend/SKILL.md` par-dessus la copie versionnée.

Les douze autres compétences du même dépôt n'ont pas été installées : six reposent
sur de la génération d'images payante, et les autres (`minimalist-ui`,
`industrial-brutalist-ui`, `high-end-visual-design`…) défendent des directions
esthétiques contradictoires entre elles. Elles restent installables à la demande,
une par une, avec l'option `--skill`.
