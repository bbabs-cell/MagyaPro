import Link from 'next/link';

import { boutiqueLandingAssetUrl } from '@/lib/storage';
import { CookieConsent } from '@/components/site/cookie-consent';

/**
 * Chrome de la vitrine publique MagyaPro Boutique (`/boutique`, `/boutique/tarifs`)
 * — même structure que la vitrine Restaurant (`src/app/(marketing)/restaurant/layout.tsx`),
 * avec l'identité visuelle propre à Boutique (voir `src/app/boutique/layout.tsx`).
 * Ne s'applique qu'à ce groupe de routes : connexion, inscription et le
 * tableau de bord gardent leur propre en-tête.
 */
export default function BoutiquePublicLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = boutiqueLandingAssetUrl();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1c1712]/90 backdrop-blur">
        <nav
          className="container-page flex h-16 items-center justify-between"
          aria-label="Navigation principale"
        >
          <Link href="/boutique" className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image de plateforme, hôte de stockage arbitraire
              <img src={logoUrl} alt="MagyaPro Boutique" className="h-8 w-8 object-contain" />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#c2603d] to-[#e0bd52] text-sm font-bold text-[#1c1712]"
              >
                M
              </span>
            )}
            <span className="font-semibold text-[#f3ece1]">MagyaPro Boutique</span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-[#f3ece1]/65 md:flex">
            <Link href="/boutique#fonctionnalites" className="hover:text-[#f3ece1]">Fonctionnalités</Link>
            <Link href="/boutique#fonctionnement" className="hover:text-[#f3ece1]">Fonctionnement</Link>
            <Link href="/boutique#secteurs" className="hover:text-[#f3ece1]">Secteurs</Link>
            <Link href="/boutique/tarifs" className="hover:text-[#f3ece1]">Tarifs</Link>
            <Link href="/boutique#faq" className="hover:text-[#f3ece1]">FAQ</Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/restaurant"
              className="hidden px-3 py-2 text-sm text-[#f3ece1]/65 hover:text-[#f3ece1] lg:block"
            >
              Vous gérez un restaurant ?
            </Link>
            <Link
              href="/boutique/connexion"
              className="hidden px-3 py-2 text-sm text-[#f3ece1]/65 hover:text-[#f3ece1] sm:block"
            >
              Se connecter
            </Link>
            <Link
              href="/boutique/inscription"
              className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-5 text-sm font-semibold text-[#1c1712]"
            >
              Commencer
            </Link>
          </div>
        </nav>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-black/20">
        <div className="container-page py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#f3ece1]">MagyaPro Boutique</p>
              <p className="mt-1 text-sm text-[#f3ece1]/60">
                La gestion complète de votre boutique ou commerce.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#f3ece1]/60">
              <Link href="/boutique#fonctionnalites" className="hover:text-[#f3ece1]">Fonctionnalités</Link>
              <Link href="/boutique/tarifs" className="hover:text-[#f3ece1]">Tarifs</Link>
              <Link href="/boutique#faq" className="hover:text-[#f3ece1]">FAQ</Link>
              <Link href="/boutique/connexion" className="hover:text-[#f3ece1]">Connexion</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#f3ece1]/40">
              © {new Date().getFullYear()} Magyapro. Tous droits réservés.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#f3ece1]/40">
              <Link href="/mentions-legales" className="hover:text-[#f3ece1]/70">Mentions légales</Link>
              <Link href="/conditions-generales" className="hover:text-[#f3ece1]/70">CGU</Link>
              <Link href="/confidentialite" className="hover:text-[#f3ece1]/70">Confidentialité</Link>
            </div>
          </div>
        </div>
      </footer>

      <CookieConsent />
    </div>
  );
}
