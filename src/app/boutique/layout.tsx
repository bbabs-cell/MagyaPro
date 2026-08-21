import type { Metadata } from 'next';

/**
 * Racine de MagyaPro Boutique (`boutique.magyapro.com`) — produit distinct de
 * MagyaPro Restaurant, servi depuis le même déploiement mais sans partager
 * son identité visuelle ni ses tokens Tailwind (`ink`/`surface`/`brand` sont
 * réservés au produit Restaurant). Les couleurs de cette section sont
 * déclarées localement, en attendant un éventuel design system dédié si le
 * produit grandit.
 */
export const metadata: Metadata = {
  title: 'MagyaPro Boutique — Gestion de boutiques et commerces',
  description:
    'MagyaPro Boutique : caisse, stock, ventes et gestion commerciale pour les boutiques et commerces. Bientôt disponible.',
};

export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#1c1712] text-[#f3ece1]">{children}</div>;
}
