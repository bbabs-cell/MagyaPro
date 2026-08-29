# Compétences de projet

Les dossiers présents ici sont chargés automatiquement par Claude Code dès qu'une
session s'ouvre sur ce dépôt — y compris les sessions distantes, qui n'ont accès à
rien d'autre que ce qui est versionné. C'est la raison pour laquelle le fichier est
copié dans le dépôt plutôt que laissé dans l'installation locale d'une machine.

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
