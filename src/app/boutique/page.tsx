import Link from 'next/link';

import { boutiqueLandingAssetUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const FEATURES = [
  { title: 'Caisse (POS)', detail: 'Vente rapide, scan code-barres, plusieurs moyens de paiement.' },
  { title: 'Stock en temps réel', detail: 'Chaque mouvement tracé — entrées, sorties, transferts, ruptures.' },
  { title: 'Achats & fournisseurs', detail: 'Commandes, réceptions, dettes fournisseurs.' },
  { title: 'Clients & crédit', detail: 'Fichier client, vente à crédit, historique des paiements.' },
  { title: 'Caisses & finances', detail: 'Ouverture/fermeture de caisse, dépenses, bénéfice estimé.' },
  { title: 'Rapports', detail: 'Ventes, stock, clients, exportables en CSV, Excel et PDF.' },
];

export default function BoutiqueLandingPage() {
  const logoUrl = boutiqueLandingAssetUrl('logo');
  const coverUrl = boutiqueLandingAssetUrl('cover');

  return (
    <div className="container-page py-20 sm:py-28">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- image de plateforme, hôte de stockage arbitraire
        <img
          src={coverUrl}
          alt=""
          className="mx-auto mb-10 h-56 w-full max-w-4xl rounded-3xl object-cover sm:h-72"
        />
      )}
      <div className="mx-auto max-w-2xl text-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- image de plateforme, hôte de stockage arbitraire
          <img src={logoUrl} alt="MagyaPro Boutique" className="mx-auto mb-6 h-14 w-14 object-contain" />
        )}
        <span className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/30 bg-[#c9a227]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-[#e0bd52]">
          Bientôt disponible
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          MagyaPro{' '}
          <span className="bg-gradient-to-r from-[#c2603d] to-[#e0bd52] bg-clip-text text-transparent">
            Boutique
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-[#f3ece1]/70 sm:text-lg">
          La gestion complète de votre boutique ou commerce : caisse, stock,
          achats, clients et finances, dans une seule application. En cours de
          construction.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/boutique/inscription"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#c2603d] to-[#e0bd52] px-8 text-sm font-semibold text-[#1c1712] sm:w-auto"
          >
            Créer mon compte (accès anticipé)
          </Link>
          <Link
            href="https://magyapro.com"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-[#f3ece1]/20 px-8 text-sm font-medium text-[#f3ece1] transition-colors hover:bg-[#f3ece1]/10 sm:w-auto"
          >
            Découvrir MagyaPro Restaurant, déjà disponible
          </Link>
        </div>
        <p className="mt-4 text-xs text-[#f3ece1]/45">
          En accès anticipé : votre compte et le nom de votre boutique sont
          réservés dès maintenant. La caisse, le stock et les ventes arrivent
          dans les prochaines mises à jour.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-[#f3ece1]/10 bg-[#f3ece1]/5 p-5"
          >
            <h2 className="font-semibold text-[#f3ece1]">{feature.title}</h2>
            <p className="mt-1.5 text-sm text-[#f3ece1]/65">{feature.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
