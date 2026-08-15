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
        // `ink`/`surface` restent des couleurs fixes pour l'admin et le
        // dashboard. Sur les sites publics des restaurants, `SiteChrome`
        // redéfinit ces variables CSS pour le mode sombre — c'est ce qui
        // permet à chaque template d'en profiter sans y toucher.
        ink: {
          DEFAULT: 'var(--ink, #12151a)',
          muted: 'var(--ink-muted, #5c6672)',
          faint: 'var(--ink-faint, #8b95a2)',
        },
        surface: {
          DEFAULT: 'var(--surface, #ffffff)',
          sunken: 'var(--surface-sunken, #f6f7f9)',
          border: 'var(--surface-border, #e4e8ed)',
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
