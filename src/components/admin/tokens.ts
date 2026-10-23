/**
 * Jetons du Super Admin, posés sur sa racine.
 *
 * Toutes ses couleurs passent par eux : `fg` (l'encre) et `canvas` (le fond)
 * s'inversent avec le thème, si bien que `text-fg/60` ou `border-fg/10` se
 * lisent pareil sur le bleu nuit et sur l'ivoire. Le mode clair reposait
 * auparavant sur une quarantaine de surcharges « blanc → noir » dans
 * `globals.css` ; neuf cents classes de couleur et une seule oubliée suffisait
 * à rendre un texte invisible — ce qui le rendait inutilisable.
 *
 * - `--domain-*` : une couleur par sujet (voir `tailwind.config.ts`), plus
 *   vive sur fond sombre, plus profonde sur fond clair pour rester lisible
 *   en texte (≥ 4,5:1 sur l'ivoire) ;
 * - `--state-*` : vert, ambre, rouge — les seuls à dire un état ;
 * - `--surface`, `--ink`, `--brand-text`… : lus par la barre de navigation du
 *   bas, partagée avec les tableaux de bord. L'élément actif y prend l'encre
 *   du thème, pas la braise : la braise désigne Restaurant ici.
 */
export const ADMIN_TOKENS: Record<'light' | 'dark', Record<string, string>> = {
  dark: {
    '--fg': '#ffffff',
    '--canvas': '#0b1730',
    '--domain-resto': '#ff7a4d',
    '--domain-boutique': '#e8c766',
    '--domain-abo': '#a78bfa',
    '--domain-users': '#38bdf8',
    '--domain-comm': '#f472b6',
    '--state-ok': '#6ee7b7',
    '--state-warn': '#fcd34d',
    '--state-bad': '#fca5a5',
    '--surface': '#0e1b36',
    '--surface-border': 'rgba(255, 255, 255, 0.12)',
    '--surface-sunken': 'rgba(255, 255, 255, 0.05)',
    '--ink': '#ffffff',
    '--ink-muted': 'rgba(255, 255, 255, 0.65)',
    '--ink-faint': 'rgba(255, 255, 255, 0.5)',
    '--brand-strong': '#ffffff',
    '--brand-text': '#ffffff',
    '--brand-ink': '#0b1730',
  },
  light: {
    '--fg': '#1c1712',
    '--canvas': '#f7f3ec',
    '--domain-resto': '#c2410c',
    '--domain-boutique': '#856404',
    '--domain-abo': '#6d28d9',
    '--domain-users': '#0369a1',
    '--domain-comm': '#be185d',
    '--state-ok': '#047857',
    '--state-warn': '#b45309',
    '--state-bad': '#b91c1c',
    '--surface': '#fffdf9',
    '--surface-border': '#e4ddd0',
    '--surface-sunken': '#efe9de',
    '--ink': '#1c1712',
    '--ink-muted': '#5f574b',
    '--ink-faint': '#6f665a',
    '--brand-strong': '#1c1712',
    '--brand-text': '#1c1712',
    '--brand-ink': '#f7f3ec',
  },
};

/**
 * Menu latéral : fond bleu nuit dans les deux thèmes, à la demande du
 * propriétaire. Il reprend les jetons du thème sombre — encre blanche,
 * couleurs de domaine vives — pour que les icônes et les traits gardent leur
 * contraste sur le bleu, quel que soit le thème du reste de l'écran.
 *
 * Le bleu est un peu plus clair que le fond du thème sombre (`--canvas`) :
 * en sombre aussi, le menu se détache de la page.
 */
export const SIDEBAR_STYLE = {
  ...ADMIN_TOKENS.dark,
  '--canvas': '#13295a',
  backgroundColor: '#13295a',
  color: '#ffffff',
  colorScheme: 'dark',
} as Record<string, string>;
