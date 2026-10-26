# MagyaPro — consignes pour Claude

- **Toujours répondre en français** au propriétaire du projet : messages, résumés, questions, descriptions de PR et messages de commit.
- La méthode de travail détaillée (design, architecture, sécurité, livraison) est dans `.claude/skills/methode-magyapro/`.
- **Mettre à jour la page vitrine à chaque nouveauté visible par les clients** : toute fonctionnalité ou modification qu'un restaurateur ou un commerçant peut voir doit apparaître sur la page d'accueil du produit concerné, dans la même PR — `src/app/(restaurant)/restaurant/page.tsx` pour Restaurant, `src/app/boutique/(public)/page.tsx` pour Boutique (et `src/app/(marketing)/page.tsx` si cela touche le choix entre les deux). Une page vitrine qui oublie ce que fait le produit est aussi fausse qu'une page qui exagère.
