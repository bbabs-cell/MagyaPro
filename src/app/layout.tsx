import { headers } from 'next/headers';
import type { Metadata, Viewport } from 'next';

import { DEFAULT_LOCALE, dirFor, type Locale } from '@/lib/i18n/locales';
import { resolveLocale } from '@/lib/i18n/server';

import { env } from '@/lib/env';
import { platformLogoUrl } from '@/lib/storage';
import { ErrorListener } from '@/components/error-listener';
import { fontVariables } from '@/lib/fonts';
import './globals.css';

/**
 * Favicon : le logo envoyé depuis Administration → Images → « Logo Magyapro »
 * sert aussi d'icône d'onglet.
 *
 * Il n'y a volontairement pas de repli. Le fichier `app/icon.svg` qui tenait
 * ce rôle dessinait une ancienne marque en dur ; il a été supprimé avec elle.
 * Sans logo envoyé, le navigateur affiche son icône par défaut plutôt qu'un
 * symbole que plus personne ne revendique.
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

/**
 * Langue et sens de lecture du document.
 *
 * `<html lang>` était figé sur « fr ». Un visiteur qui passait une vitrine en
 * arabe recevait donc une page **déclarée française mais écrite en arabe** :
 * un lecteur d'écran la prononçait avec une voix française, et un moteur de
 * recherche l'indexait comme du français.
 *
 * Seules les vitrines changent de langue — le tableau de bord reste en
 * français. Le middleware marque les requêtes concernées ; ailleurs, la
 * préférence du visiteur ne doit pas déteindre sur l'interface du
 * commerçant.
 */
async function documentLanguage(): Promise<{ lang: Locale; dir: 'ltr' | 'rtl' }> {
  const requestHeaders = await headers();
  if (requestHeaders.get('x-public-site') !== '1') {
    return { lang: DEFAULT_LOCALE, dir: 'ltr' };
  }
  const locale = await resolveLocale();
  return { lang: locale, dir: dirFor(locale) };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, dir } = await documentLanguage();

  return (
    <html lang={lang} dir={dir} className={fontVariables}>
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
