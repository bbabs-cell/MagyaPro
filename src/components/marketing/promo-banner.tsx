/**
 * Bandeau d'offre de lancement — n'apparaît que si le Super Admin a
 * configuré une remise active (voir `getActivePromo`). Purement informatif :
 * la remise elle-même est appliquée côté serveur au moment du paiement
 * (`createSubscriptionPaymentRequest`), jamais recalculée côté client.
 */
export function PromoBanner({
  discountPercent,
  endsAt,
  label,
}: {
  discountPercent: number;
  endsAt: Date;
  label: string | null;
}) {
  // Couleurs fixes plutôt que les tokens ink/surface : ce bandeau apparaît
  // aussi bien sur des sections claires que sur le hero sombre, et doit
  // rester lisible dans les deux sans variante séparée par contexte.
  return (
    <p className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] px-4 py-1.5 text-sm font-medium text-white shadow-[0_6px_20px_-6px_rgba(255,94,46,0.6)]">
      <span aria-hidden="true">🎁</span>
      {label ?? `-${discountPercent}% sur votre premier paiement`}
      <span className="text-xs font-normal text-white/80">
        · jusqu&apos;au{' '}
        {endsAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
      </span>
    </p>
  );
}
