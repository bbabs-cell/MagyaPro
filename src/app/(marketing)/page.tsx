import Link from 'next/link';
import type { Metadata } from 'next';

import { platformLogoUrl } from '@/lib/storage';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Magyapro — Restaurant ou Boutique',
  description: 'Choisissez votre activité : MagyaPro Restaurant ou MagyaPro Boutique.',
};

const PRODUCTS = [
  {
    key: 'restaurant',
    href: '/restaurant',
    name: 'MagyaPro Restaurant',
    tagline: 'Pour restaurateurs',
    description:
      'Votre site, votre menu et vos commandes en ligne — livraison, retrait et suivi client.',
    features: ['Menu digital', 'Commandes en ligne', 'Zones de livraison', 'Statistiques'],
    accent: 'from-[#ff9a4d] to-[#ff5e2e]',
    bg: 'bg-[#0b1730]',
  },
  {
    key: 'boutique',
    href: '/boutique',
    name: 'MagyaPro Boutique',
    tagline: 'Pour boutiques et commerces',
    description:
      'Caisse, stock, achats, clients et finances pour votre boutique — en ligne et sur place.',
    features: ['Caisse (POS)', 'Stock en temps réel', 'Achats & fournisseurs', 'Rapports'],
    accent: 'from-[#c2603d] to-[#e0bd52]',
    bg: 'bg-[#1c1712]',
  },
] as const;

export default function HubPage() {
  const logoUrl = platformLogoUrl();

  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Logo src={logoUrl} showText={false} className="mx-auto h-14 w-14" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">
          Quelle activité gérez-vous ?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">
          Magyapro propose deux plateformes distinctes, chacune pensée pour son métier.
          Choisissez la vôtre.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
        {PRODUCTS.map((product) => (
          <Link
            key={product.key}
            href={product.href}
            className={`group relative overflow-hidden rounded-3xl border border-white/10 ${product.bg} p-8 text-white shadow-xl transition-transform hover:scale-[1.02]`}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              {product.tagline}
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{product.name}</h2>
            <p className="mt-3 text-sm text-white/70">{product.description}</p>
            <ul className="mt-6 space-y-1.5 text-sm text-white/60">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                  {feature}
                </li>
              ))}
            </ul>
            <span
              className={`mt-8 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r ${product.accent} px-6 text-sm font-semibold text-white transition-transform group-hover:translate-x-1`}
            >
              Découvrir
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
