import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { resolvePublicStore } from '@/lib/boutique/site/resolve';

/**
 * Racine du site public d'une boutique, atteinte via
 * `boutique.magyapro.com/s/<slug>` (voir le commentaire dans
 * `src/middleware.ts` — un sous-domaine dédié par boutique demanderait de
 * déléguer les serveurs de noms à Vercel, ce que le registrar actuel ne
 * permet pas). Première version volontairement
 * simple : pas de thème par tenant (`Store` n'a ni `templateKey` ni
 * `fontFamily`, à la différence de `Restaurant`), une seule mise en page
 * neutre pour toutes les boutiques. Styles en dur (jamais les tokens
 * `ink`/`surface`/`brand`, réservés au dashboard Restaurant — voir le
 * commentaire de `src/app/boutique/layout.tsx`).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const store = await resolvePublicStore(host);
  if (!store) return { title: 'Boutique introuvable' };

  return {
    title: store.name,
    description: store.description ?? `${store.name} sur MagyaPro Boutique.`,
    robots: store.isDemo ? { index: false, follow: false } : undefined,
    openGraph: {
      title: store.name,
      description: store.description ?? undefined,
      images: store.coverUrl ? [store.coverUrl] : store.logoUrl ? [store.logoUrl] : undefined,
    },
  };
}

export default async function StoreSiteLayout({
  params,
  children,
}: {
  params: Promise<{ host: string }>;
  children: React.ReactNode;
}) {
  const { host } = await params;
  const store = await resolvePublicStore(host);
  if (!store) notFound();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/s/${host}`} className="flex items-center gap-2.5">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo déposé par le tenant
              <img src={store.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {store.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="font-semibold tracking-tight">{store.name}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={`/s/${host}/produits`} className="text-gray-600 hover:text-gray-900">
              Catalogue
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-16 border-t border-gray-200 py-8 text-center text-xs text-gray-400">
        <p>{store.name}</p>
        <p className="mt-1">
          Propulsé par{' '}
          <a href="https://magyapro.com" className="underline underline-offset-2">
            MagyaPro
          </a>
        </p>
      </footer>
    </div>
  );
}
