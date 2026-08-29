import type { Metadata, Viewport } from 'next';

import { env } from '@/lib/env';
import { platformLogoUrl } from '@/lib/storage';
import { ErrorListener } from '@/components/error-listener';
import { fontVariables } from '@/lib/fonts';
import './globals.css';

/**
 * Favicon dynamique : dès qu'un logo de plateforme est envoyé (Administration
 * → Logo Magyapro), il devient aussi l'icône d'onglet — sans lui, le fichier
 * statique `app/icon.svg` (marque vectorielle de repli) prend le relais.
 */
export async function generateMetadata(): Promise<Metadata> {
  const logoUrl = platformLogoUrl();

  return {
    metadataBase: new URL(env.appUrl),
    title: {
      default: 'Magyapro — Créez votre restaurant en ligne simplement',
      template: '%s — Magyapro',
    },
    description:
      'Magyapro vous permet de créer rapidement un site professionnel pour votre restaurant, présenter votre menu, recevoir des commandes et développer votre présence digitale.',
    applicationName: 'Magyapro',
    icons: logoUrl ? { icon: logoUrl } : undefined,
    openGraph: {
      type: 'website',
      siteName: 'Magyapro',
      locale: 'fr_FR',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12151a',
  // Le `color-scheme: light` de globals.css ne suffit pas à empêcher le
  // mode sombre forcé de Chrome/Android (assombrissement automatique des
  // pages) : ces navigateurs vérifient spécifiquement cette balise <meta>,
  // pas seulement la propriété CSS. Sans elle, certains éléments se
  // retrouvent réinterprétés en clair sur fond clair (texte quasi invisible).
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={fontVariables}>
      <body>
        {env.sentryDsn && (
          // Le DSN Sentry n'est pas un secret (voir `env.ts`), mais il n'est
          // pas non plus disponible au moment du build sur ce déploiement
          // (le `.env` est volontairement absent lors de `cf:deploy`) : il
          // est donc posé ici, rendu côté serveur à chaque requête, plutôt
          // qu'inliné via `NEXT_PUBLIC_`.
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__SENTRY_DSN__=${JSON.stringify(env.sentryDsn)};`,
            }}
          />
        )}
        <a
          href="#contenu"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-ink px-4 py-2 text-sm text-white"
        >
          Aller au contenu principal
        </a>
        <ErrorListener />
        {children}
      </body>
    </html>
  );
}
