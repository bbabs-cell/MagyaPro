import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth/session';
import { LinkButton } from '@/components/ui';
import { Logo } from '@/components/ui/logo';
import { platformLogoUrl } from '@/lib/storage';
import { env } from '@/lib/env';
import { CookieConsent } from '@/components/site/cookie-consent';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const logoUrl = platformLogoUrl();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/85 backdrop-blur">
        <nav
          className="container-page flex h-16 items-center justify-between"
          aria-label="Navigation principale"
        >
          <Link href="/restaurant" className="flex items-center gap-2">
            <Logo src={logoUrl} />
          </Link>

          <div className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
            <Link href="/restaurant#fonctionnalites" className="hover:text-ink">Fonctionnalités</Link>
            <Link href="/restaurant#fonctionnement" className="hover:text-ink">Fonctionnement</Link>
            <Link href="/restaurant#templates" className="hover:text-ink">Templates</Link>
            <Link href="/restaurant/tarifs" className="hover:text-ink">Tarifs</Link>
            <Link href="/restaurant#faq" className="hover:text-ink">FAQ</Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/boutique"
              className="hidden px-3 py-2 text-sm text-ink-muted hover:text-ink lg:block"
            >
              Vous gérez une boutique ?
            </Link>
            {user ? (
              <LinkButton href="/dashboard" size="sm">
                Mon tableau de bord
              </LinkButton>
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="hidden px-3 py-2 text-sm text-ink-muted hover:text-ink sm:block"
                >
                  Se connecter
                </Link>
                <LinkButton href="/inscription" size="sm">
                  Commencer
                </LinkButton>
              </>
            )}
          </div>
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
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- hôte de stockage arbitraire
                  <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
                )}
                <p className="font-semibold">Magyapro</p>
              </span>
              <p className="mt-1 text-sm text-ink-muted">
                La présence en ligne des restaurants, sans complexité technique.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              <Link href="/restaurant#fonctionnalites" className="hover:text-ink">Fonctionnalités</Link>
              <Link href="/restaurant/tarifs" className="hover:text-ink">Tarifs</Link>
              <Link href="/restaurant#faq" className="hover:text-ink">FAQ</Link>
              <Link href="/connexion" className="hover:text-ink">Connexion</Link>
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
