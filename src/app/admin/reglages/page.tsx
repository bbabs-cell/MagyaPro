import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/session';
import { getPlatformSettings } from '@/lib/platform-settings';
import { DEFAULT_ADDITIONAL_STORE_PERCENT } from '@/lib/boutique/store-pricing';
import { PlatformPaymentSettings } from '@/components/admin/platform-payment-settings';
import { PlatformSoundSettings } from '@/components/admin/platform-sound-settings';

export const metadata: Metadata = { title: 'Réglages de la plateforme' };
export const dynamic = 'force-dynamic';

/**
 * Réglages de la plateforme elle-même.
 *
 * Les numéros de réception Wave et Orange Money servent aux deux produits,
 * mais ils n'étaient modifiables que depuis la page des abonnements
 * Restaurant — introuvables pour qui gère les abonnements Boutique, et
 * noyés au-dessus de la liste. Ils ont désormais leur place, nommée comme on
 * la cherche.
 */
export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const settings = await getPlatformSettings();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
      <p className="mt-1 text-sm text-fg/60">
        Paiement des abonnements et son des notifications, pour MagyaPro Restaurant et MagyaPro Boutique.
      </p>

      <section aria-labelledby="reglages-paiement" className="mt-6 rounded-2xl border border-fg/10 bg-fg/5 p-4 sm:p-5">
        <h2 id="reglages-paiement" className="text-base font-medium">Réglages de paiement</h2>
        <p className="mt-1 text-sm text-fg/60">
          Restaurants et boutiques envoient le montant de leur abonnement à ces numéros, puis déposent
          une capture que vous validez dans Abonnements. Sans numéro, le moyen de paiement n&apos;est
          pas proposé.
        </p>
        <div className="mt-4">
          <PlatformPaymentSettings
            waveNumber={settings?.waveNumber ?? null}
            orangeMoneyNumber={settings?.orangeMoneyNumber ?? null}
            promoDiscountPercent={settings?.promoDiscountPercent ?? null}
            promoEndsAt={settings?.promoEndsAt ?? null}
            promoLabel={settings?.promoLabel ?? null}
            additionalStorePercent={settings?.additionalStorePercent ?? DEFAULT_ADDITIONAL_STORE_PERCENT}
          />
        </div>
      </section>

      <section aria-labelledby="reglages-son" className="mt-6 rounded-2xl border border-fg/10 bg-fg/5 p-4 sm:p-5">
        <h2 id="reglages-son" className="text-base font-medium">Son des notifications</h2>
        <div className="mt-3">
          <PlatformSoundSettings soundUrl={settings?.notificationSoundUrl ?? null} />
        </div>
      </section>
    </>
  );
}
