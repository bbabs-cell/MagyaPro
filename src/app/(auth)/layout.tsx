import Link from 'next/link';

import { Logo } from '@/components/ui/logo';
import { platformLogoUrl } from '@/lib/storage';
import { CookieConsent } from '@/components/site/cookie-consent';

/**
 * Connexion, inscription, mot de passe oublié : mêmes deux volets pour les
 * quatre pages. À gauche (à partir de `lg`), un panneau de marque reprend
 * l'identité de la page d'accueil — sur mobile il s'efface derrière un
 * simple en-tête, la place manquant pour les deux à la fois.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logoUrl = platformLogoUrl();

  return (
    <div className="flex min-h-screen">
      <aside
        aria-hidden="true"
        className="relative hidden w-[42%] shrink-0 overflow-hidden bg-[#0b1730] lg:flex lg:flex-col lg:justify-between"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="auth-blob pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-[#2f5bd8] opacity-40 blur-[110px]" />
        <div className="auth-blob auth-blob-delay pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-[#ff5e2e] opacity-30 blur-[110px]" />

        <div className="relative p-10">
          <Logo src={logoUrl} textClassName="text-lg text-white" />
        </div>

        <div className="relative p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff9a4d]">
            Bienvenue
          </p>
          <h2 className="mt-4 max-w-sm text-3xl font-bold leading-[1.15] tracking-tight text-white">
            Votre restaurant, en ligne en quelques minutes.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Menu, commandes et présence digitale : tout ce dont votre
            établissement a besoin, sans complexité technique.
          </p>
        </div>

        <div className="relative p-10 text-xs text-white/35">
          © {new Date().getFullYear()} Magyapro
        </div>
      </aside>

      <div className="flex flex-1 flex-col bg-surface-sunken">
        <header className="container-page py-6 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo src={logoUrl} />
          </Link>
        </header>

        <main
          id="contenu"
          className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0"
        >
          <div className="auth-panel w-full max-w-md">{children}</div>
        </main>
      </div>

      <CookieConsent />
    </div>
  );
}
