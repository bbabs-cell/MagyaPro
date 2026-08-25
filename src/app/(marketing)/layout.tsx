import Link from 'next/link';

import { Logo, LogoMark } from '@/components/ui/logo';
import { platformLogoUrl } from '@/lib/storage';
import { env } from '@/lib/env';
import { CookieConsent } from '@/components/site/cookie-consent';

/**
 * Chrome minimal du hub (`/`) et des pages légales (`/mentions-legales`,
 * `/conditions-generales`, `/confidentialite`) — communes aux deux produits,
 * donc sans nav ni CTA propres à l'un ou l'autre. Chaque produit a sa propre
 * vitrine complète, avec sa propre identité visuelle et son propre en-tête :
 * `/restaurant` (voir `restaurant/layout.tsx`) et `/boutique`
 * (`src/app/boutique/layout.tsx`).
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = platformLogoUrl();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/85 backdrop-blur">
        <nav
          className="container-page flex h-16 items-center justify-between"
          aria-label="Navigation principale"
        >
          <Link href="/" className="flex items-center gap-2">
            <Logo src={logoUrl} />
          </Link>
        </nav>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-surface-border bg-surface-sunken">
        <div className="container-page py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="flex items-center gap-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- hôte de stockage arbitraire
                  <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
                ) : (
                  <LogoMark className="h-6 w-6" />
                )}
                <p className="font-semibold">Magyapro</p>
              </span>
              <p className="mt-1 text-sm text-ink-muted">
                Deux produits, une même plateforme : Restaurant et Boutique.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              <Link href="/restaurant" className="hover:text-ink">MagyaPro Restaurant</Link>
              <Link href="/boutique" className="hover:text-ink">MagyaPro Boutique</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-faint">
              © {new Date().getFullYear()} Magyapro. Tous droits réservés.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
              <Link href="/mentions-legales" className="hover:text-ink-muted">Mentions légales</Link>
              <Link href="/conditions-generales" className="hover:text-ink-muted">CGU</Link>
              <Link href="/confidentialite" className="hover:text-ink-muted">Confidentialité</Link>
            </div>
          </div>
        </div>
      </footer>

      <CookieConsent metaPixelId={env.metaPixelId ?? null} gaMeasurementId={env.gaMeasurementId ?? null} />
    </div>
  );
}
