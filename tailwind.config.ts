import type { Config } from 'tailwindcss';

/**
 * Couleur pilotée par une variable CSS, **et qui accepte un modificateur
 * d'opacité**.
 *
 * Toutes les couleurs du thème s'écrivaient `'var(--ink, #211d16)'`. Tailwind
 * accepte cette forme, mais il ne sait pas en dériver une variante d'opacité :
 * il ne peut pas insérer un canal alpha dans une valeur qu'il ne lit pas. Et
 * il ne le signale pas — il **n'émet simplement aucune règle**.
 *
 * Conséquence, mesurée dans la feuille de style produite : `.bg-ink` existe,
 * `.bg-ink\/90` n'existe pas. Vingt-neuf classes du produit étaient donc
 * inertes, sans qu'aucune erreur ne l'indique :
 *
 * - `hover:bg-ink/90` sur une quinzaine de boutons — le survol ne changeait
 *   rien, alors que le code dit le contraire ;
 * - `bg-ink/25` sur les barres inactives de l'histogramme horaire : une barre
 *   sans fond est une barre **invisible**, donc un graphique qui n'affiche que
 *   son heure de pointe ;
 * - `bg-ink/20` sur les filets décoratifs de deux gabarits de vitrine, hauts
 *   d'un pixel et sans couleur : invisibles eux aussi ;
 * - `border-state-warn/30` sur le bandeau d'échéance ajouté hier, qui
 *   retombait sur la bordure neutre globale.
 *
 * `color-mix` fait ce que Tailwind ne peut pas faire ici : mélanger la couleur
 * — quelle que soit sa valeur au moment du rendu, thème clair, thème sombre ou
 * palette de restaurant — avec du transparent. Sans modificateur, la valeur
 * reste exactement celle d'avant, pour ne rien changer aux règles qui
 * fonctionnaient.
 */
function themed(variable: string, fallback: string): string {
  const value = `var(${variable}, ${fallback})`;
  const resolve = ({ opacityValue }: { opacityValue?: string } = {}) => {
    /**
     * Tailwind appelle cette fonction dans **deux** cas, et c'est le piège.
     *
     * - `bg-ink/25` → `opacityValue` vaut `'0.25'`, un nombre ;
     * - `bg-ink` tout court → `opacityValue` vaut `'var(--tw-bg-opacity)'`,
     *   une expression CSS que seul le navigateur sait résoudre.
     *
     * Une première version faisait `Number(opacityValue) * 100` sans
     * distinguer les deux. Sur le second cas cela donnait `NaN%`, donc une
     * déclaration invalide, donc **aucune couleur** — sur chaque fond et
     * chaque texte des deux produits et du site public. Le CSS se compilait
     * sans erreur ; seul le navigateur jetait la règle, en silence.
     *
     * Une valeur d'opacité qui n'est pas un nombre n'a donc rien à faire dans
     * un calcul : la couleur est rendue telle quelle, exactement comme avant
     * l'introduction de cette fonction.
     */
    const alpha = opacityValue === undefined ? Number.NaN : Number(opacityValue);
    return Number.isFinite(alpha)
      ? `color-mix(in srgb, ${value} ${alpha * 100}%, transparent)`
      : value;
  };

  // Tailwind appelle bien cette fonction à la génération — c'est la forme
  // documentée pour une couleur qui doit connaître l'opacité demandée. Ses
  // types publiés, eux, n'annoncent qu'une chaîne pour une couleur imbriquée.
  // La conversion est donc un défaut de déclaration, pas un contournement du
  // fonctionnement : la vérification ci-dessous porte sur le CSS produit.
  return resolve as unknown as string;
}

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Public restaurant sites drive these from the tenant's own palette,
        // injected as CSS custom properties by the template renderer.
        brand: {
          DEFAULT: themed('--brand', '#ff5e2e'),
          soft: themed('--brand-soft', '#fff1e6'),
          ink: themed('--brand-ink', '#ffffff'),
        },
        // Bleu nuit de la marque Magyapro (héros/CTA du site marketing) —
        // fixe, pas piloté par tenant : réservé à l'admin et au dashboard.
        navy: '#0b1730',
        // `ink`/`surface` : jamais de blanc pur, un ivoire doux plus reposant
        // pour les yeux.
        //
        // Les valeurs écrites ici ne sont que des replis, et elles ne
        // servent en pratique jamais : `globals.css` déclare ces variables
        // sur `:root`, donc pour tout le produit. Elles sont tenues
        // identiques à cette déclaration par principe — un repli qui
        // diverge de la vraie valeur est une seconde vérité en sommeil, et
        // c'est exactement ce qui s'était produit ici, à deux ou trois
        // points près sur chaque canal.
        //
        // Le passage par variable CSS reste nécessaire à deux titres : le
        // reçu imprimable (`app/recu/layout.tsx`) repasse en blanc pur à
        // l'impression, et le tableau de bord Boutique propose un thème
        // sombre.
        ink: {
          DEFAULT: themed('--ink', '#211d16'),
          muted: themed('--ink-muted', '#6a6153'),
          faint: themed('--ink-faint', '#948b7b'),
        },
        surface: {
          DEFAULT: themed('--surface', '#fbf8f2'),
          sunken: themed('--surface-sunken', '#ece5d8'),
          border: themed('--surface-border', '#ddd3c1'),
          // Surface légèrement surélevée au-dessus d'une carte (en-tête de
          // tableau, ligne survolée) — la profondeur vient d'un empilement de
          // valeurs, pas d'une ombre seule.
          raised: themed('--surface-raised', '#ffffff'),
        },
        // Barre latérale et menu du tableau de bord Boutique. Séparés de
        // `surface` parce qu'ils restent foncés dans les deux thèmes : la
        // navigation doit rester un repère stable quand le contenu, lui,
        // s'éclaircit ou s'assombrit.
        nav: {
          DEFAULT: themed('--nav', '#2a2118'),
          raised: themed('--nav-raised', '#35291d'),
          ink: themed('--nav-ink', '#f5efe3'),
          muted: themed('--nav-muted', '#b3a894'),
          border: themed('--nav-border', 'rgba(245,239,227,0.10)'),
        },
        // Couleurs sémantiques, indépendantes de l'accent de marque : elles
        // disent un état (stock sain, seuil franchi, rupture), jamais une
        // identité. Le brief demande explicitement des états de stock
        // lisibles d'un coup d'œil.
        state: {
          ok: themed('--state-ok', '#047857'),
          'ok-soft': themed('--state-ok-soft', '#ecfdf5'),
          warn: themed('--state-warn', '#b45309'),
          'warn-soft': themed('--state-warn-soft', '#fffbeb'),
          bad: themed('--state-bad', '#b91c1c'),
          'bad-soft': themed('--state-bad-soft', '#fef2f2'),
        },
      },
      boxShadow: {
        // Deux couches : un contact net et proche, une diffusion large et
        // douce. Une ombre unique donne un rendu plat et « collé ».
        elev1: 'var(--elev-1, 0 1px 2px rgba(33,29,22,.06), 0 6px 16px -10px rgba(33,29,22,.18))',
        elev2: 'var(--elev-2, 0 2px 4px rgba(33,29,22,.07), 0 16px 32px -18px rgba(33,29,22,.26))',
        // Halo de braise du bouton principal (skill « animations vivantes »).
        glow: '0 10px 28px -10px rgba(255,94,46,.5), 0 4px 12px -6px rgba(255,94,46,.4)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Repli sur la pile de corps de texte, jamais sur une serif : les
        // sites publics des restaurants surchargent `--font-display` avec
        // leur propre police, et un repli serif y produirait un mélange
        // involontaire le temps du chargement.
        display: ['var(--font-display, var(--font-sans))', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      // Le vocabulaire du skill « animations vivantes » (dépôt ATELIERFLOW),
      // traduit pour Tailwind 3 : seuls `transform` et `opacity` bougent, et
      // la règle globale de `globals.css` coupe tout pour qui a demandé moins
      // de mouvement. Voir « Motion » dans DESIGN.md pour l'emploi de chacun.
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        veil: { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'slide-in-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'grow-up': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        'nav-progress': {
          '0%': { transform: 'scaleX(0)' },
          '60%': { transform: 'scaleX(0.75)' },
          '100%': { transform: 'scaleX(0.95)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        veil: 'veil 0.2s ease-out both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-up': 'slide-in-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'grow-up': 'grow-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
        // Long et décélérant : la barre avance tant que le serveur travaille,
        // sans jamais prétendre être arrivée.
        'nav-progress': 'nav-progress 8s cubic-bezier(0.1, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
