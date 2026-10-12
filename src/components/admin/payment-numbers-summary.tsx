import Link from 'next/link';

/**
 * Rappel des numéros de réception en tête des pages d'abonnements, avec le
 * lien vers Réglages où ils se modifient. Un numéro absent est signalé :
 * sans lui, aucun commerçant ne peut payer par ce moyen.
 */
export function PaymentNumbersSummary({
  waveNumber,
  orangeMoneyNumber,
}: {
  waveNumber: string | null;
  orangeMoneyNumber: string | null;
}) {
  const missing = !waveNumber && !orangeMoneyNumber;
  return (
    <div
      className={`mt-6 flex flex-col gap-2 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${
        missing ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <p className="min-w-0 text-white/70">
        {missing ? (
          <span className="text-amber-200">
            Aucun numéro de réception : les commerçants ne peuvent pas payer leur abonnement.
          </span>
        ) : (
          <>
            Numéros de réception : <span className="text-white">Wave {waveNumber ?? '—'}</span>
            {' · '}
            <span className="text-white">Orange Money {orangeMoneyNumber ?? '—'}</span>
          </>
        )}
      </p>
      <Link
        href="/admin/reglages"
        className="shrink-0 self-start rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 sm:self-auto"
      >
        {missing ? 'Configurer' : 'Modifier'}
      </Link>
    </div>
  );
}
