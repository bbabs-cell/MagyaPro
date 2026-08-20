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
        // `ink`/`surface` sont pilotées par variables CSS, redéfinies par
        // `SiteChrome` (sites publics) et `DashboardShell` (tableau de bord)
        // selon le thème actif. Les valeurs par défaut ci-dessous sont le
        // thème dark premium — l'identité visuelle par défaut du produit —
        // teintées bleu nuit pour prolonger le `navy` de la marque plutôt
        // qu'un gris neutre. Le thème clair (optionnel, jamais blanc pur)
        // est appliqué en surcharge explicite quand l'utilisateur le choisit.
        ink: {
          DEFAULT: 'var(--ink, #f2f4f8)',
          muted: 'var(--ink-muted, #a6adbb)',
          faint: 'var(--ink-faint, #757d8f)',
        },
        surface: {
          DEFAULT: 'var(--surface, #10131c)',
          sunken: 'var(--surface-sunken, #171b26)',
          border: 'var(--surface-border, #262c3b)',
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
