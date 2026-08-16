'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * Numéros Wave/Orange Money de la plateforme, receveurs des paiements
 * d'abonnement des restaurateurs (voie manuelle avec preuve).
 */
/** `Date` → valeur d'un `<input type="date">` (fuseau local, pas UTC). */
function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function PlatformPaymentSettings({
  waveNumber,
  orangeMoneyNumber,
  promoDiscountPercent,
  promoEndsAt,
  promoLabel,
}: {
  waveNumber: string | null;
  orangeMoneyNumber: string | null;
  promoDiscountPercent: number | null;
  promoEndsAt: Date | null;
  promoLabel: string | null;
}) {
  const router = useRouter();
  const [wave, setWave] = useState(waveNumber ?? '');
  const [orange, setOrange] = useState(orangeMoneyNumber ?? '');
  const [discount, setDiscount] = useState(promoDiscountPercent?.toString() ?? '');
  const [endsAt, setEndsAt] = useState(toDateInputValue(promoEndsAt));
  const [label, setLabel] = useState(promoLabel ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const percent = discount.trim() ? Number(discount) : null;
      await api.post('/api/admin/parametres-paiement', {
        waveNumber: wave.trim() || null,
        orangeMoneyNumber: orange.trim() || null,
        promoDiscountPercent: percent,
        promoEndsAt: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
        promoLabel: label.trim() || null,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Les réglages n'ont pas pu être enregistrés.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="wave-number" className="block text-xs font-medium text-white/70">
          Numéro Wave (plateforme)
        </label>
        <input
          id="wave-number"
          value={wave}
          onChange={(event) => setWave(event.target.value)}
          placeholder="+221 77 000 00 00"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="om-number" className="block text-xs font-medium text-white/70">
          Numéro Orange Money (plateforme)
        </label>
        <input
          id="om-number"
          value={orange}
          onChange={(event) => setOrange(event.target.value)}
          placeholder="+221 77 000 00 00"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
      </div>

      <div className="sm:col-span-2 border-t border-white/10 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-white/40">
          Offre de lancement (facultatif)
        </p>
        <p className="mt-1 text-xs text-white/50">
          Remise appliquée automatiquement au premier paiement d&apos;un
          restaurant, tant que la date de fin n&apos;est pas dépassée.
        </p>
      </div>
      <div>
        <label htmlFor="promo-discount" className="block text-xs font-medium text-white/70">
          Remise (%)
        </label>
        <input
          id="promo-discount"
          type="number"
          min={1}
          max={90}
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          placeholder="20"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="promo-ends-at" className="block text-xs font-medium text-white/70">
          Fin de l&apos;offre
        </label>
        <input
          id="promo-ends-at"
          type="date"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="promo-label" className="block text-xs font-medium text-white/70">
          Texte du bandeau (facultatif)
        </label>
        <input
          id="promo-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="-20% sur votre premier mois"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="ml-3 text-xs text-emerald-400">Enregistré.</span>}
        {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
