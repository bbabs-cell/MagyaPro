import type { Metadata, Viewport } from 'next';

import { env } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: 'Magya — Créez votre restaurant en ligne simplement',
    template: '%s — Magya',
  },
  description:
    'Magya vous permet de créer rapidement un site professionnel pour votre restaurant, présenter votre menu, recevoir des commandes et développer votre présence digitale.',
  applicationName: 'Magya',
  openGraph: {
    type: 'website',
    siteName: 'Magya',
    locale: 'fr_FR',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12151a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <a
          href="#contenu"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-ink px-4 py-2 text-sm text-white"
        >
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
