import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth/session';
import { LinkButton } from '@/components/ui';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-white/85 backdrop-blur">
        <nav
          className="container-page flex h-16 items-center justify-between"
          aria-label="Navigation principale"
        >
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              M
            </span>
            <span className="text-lg font-semibold tracking-tight">Magyapro</span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
            <a href="#fonctionnalites" className="hover:text-ink">Fonctionnalités</a>
            <a href="#fonctionnement" className="hover:text-ink">Fonctionnement</a>
            <a href="#templates" className="hover:text-ink">Templates</a>
            <a href="#tarifs" className="hover:text-ink">Tarifs</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </div>

          <div className="flex items-center gap-2">
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
              <p className="font-semibold">Magyapro</p>
              <p className="mt-1 text-sm text-ink-muted">
                La présence en ligne des restaurants, sans complexité technique.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              <a href="#fonctionnalites" className="hover:text-ink">Fonctionnalités</a>
              <a href="#tarifs" className="hover:text-ink">Tarifs</a>
              <a href="#faq" className="hover:text-ink">FAQ</a>
              <Link href="/connexion" className="hover:text-ink">Connexion</Link>
            </div>
          </div>
          <p className="mt-8 text-xs text-ink-faint">
            © {new Date().getFullYear()} Magyapro. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
