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
        },
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
