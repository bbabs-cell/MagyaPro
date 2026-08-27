import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Public restaurant sites drive these from the tenant's own palette,
        // injected as CSS custom properties by the template renderer.
        brand: {
          DEFAULT: 'var(--brand, #ff5e2e)',
          soft: 'var(--brand-soft, #fff1e6)',
          ink: 'var(--brand-ink, #ffffff)',
        },
        // Bleu nuit de la marque Magyapro (héros/CTA du site marketing) —
        // fixe, pas piloté par tenant : réservé à l'admin et au dashboard.
        navy: '#0b1730',
        // `ink`/`surface` : un seul thème, clair, jamais en blanc pur (un
        // ivoire doux, plus reposant pour les yeux). Restent pilotées par
        // variable CSS uniquement pour permettre au reçu imprimable
        // (`app/recu/layout.tsx`) de repasser en blanc pur à l'impression —
        // aucun composant ne bascule plus ces variables pour un mode sombre.
        ink: {
          DEFAULT: 'var(--ink, #221f1a)',
          muted: 'var(--ink-muted, #6b6459)',
          faint: 'var(--ink-faint, #948c7e)',
        },
        surface: {
          DEFAULT: 'var(--surface, #faf8f4)',
          sunken: 'var(--surface-sunken, #f1ede4)',
          border: 'var(--surface-border, #e3ddd0)',
          // Surface légèrement surélevée au-dessus d'une carte (en-tête de
          // tableau, ligne survolée) — la profondeur vient d'un empilement de
          // valeurs, pas d'une ombre seule.
          raised: 'var(--surface-raised, #ffffff)',
        },
        // Barre latérale et menu du tableau de bord Boutique. Séparés de
        // `surface` parce qu'ils restent foncés dans les deux thèmes : la
        // navigation doit rester un repère stable quand le contenu, lui,
        // s'éclaircit ou s'assombrit.
        nav: {
          DEFAULT: 'var(--nav, #2a2118)',
          raised: 'var(--nav-raised, #35291d)',
          ink: 'var(--nav-ink, #f5efe3)',
          muted: 'var(--nav-muted, #b3a894)',
          border: 'var(--nav-border, rgba(245,239,227,0.10))',
        },
        // Couleurs sémantiques, indépendantes de l'accent de marque : elles
        // disent un état (stock sain, seuil franchi, rupture), jamais une
        // identité. Le brief demande explicitement des états de stock
        // lisibles d'un coup d'œil.
        state: {
          ok: 'var(--state-ok, #047857)',
          'ok-soft': 'var(--state-ok-soft, #ecfdf5)',
          warn: 'var(--state-warn, #b45309)',
          'warn-soft': 'var(--state-warn-soft, #fffbeb)',
          bad: 'var(--state-bad, #b91c1c)',
          'bad-soft': 'var(--state-bad-soft, #fef2f2)',
        },
      },
      boxShadow: {
        // Deux couches : un contact net et proche, une diffusion large et
        // douce. Une ombre unique donne un rendu plat et « collé ».
        elev1: 'var(--elev-1, 0 1px 2px rgba(33,29,22,.06), 0 6px 16px -10px rgba(33,29,22,.18))',
        elev2: 'var(--elev-2, 0 2px 4px rgba(33,29,22,.07), 0 16px 32px -18px rgba(33,29,22,.26))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display, var(--font-sans))', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
