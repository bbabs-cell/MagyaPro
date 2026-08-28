import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { TaxSettingsPanel } from '@/components/boutique/tax-settings-panel';
import { LanguageSettingsPanel } from '@/components/boutique/language-settings-panel';
import { StockSettingsPanel } from '@/components/boutique/stock-settings-panel';
import { SectorSettingsPanel } from '@/components/boutique/sector-settings-panel';
import { ensureStoreUnitsReady } from '@/lib/boutique/units-engine';
import { toQty } from '@/lib/boutique/quantity';
import { NotificationSoundPanel } from '@/components/boutique/notification-sound-panel';
import { PaymentMethodsManager } from '@/components/boutique/payment-methods-manager';
import { getEnabledPaymentMethods } from '@/lib/boutique/payment-methods';

export const metadata: Metadata = { title: 'Réglages' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueSettingsPage() {
  const context = await requireStore('store:view');

  // Sème les moyens de paiement par défaut si la boutique n'a encore rien
  // configuré (voir `getEnabledPaymentMethods`), avant de lire la liste
  // complète (activés et désactivés) pour cet écran de gestion.
  await getEnabledPaymentMethods(context.store.id);

  // Sème les unités du secteur si ce n'est pas déjà fait — sans quoi la
  // liste ci-dessous s'afficherait vide sur une boutique qui n'a pas encore
  // ouvert ses écrans Produits ou Caisse.
  await ensureStoreUnitsReady(context.store.id, context.store.businessType);

  const [units, paymentMethods] = await Promise.all([
    prisma.storeUnit.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ isActive: 'desc' }, { position: 'asc' }],
    }),
    prisma.storePaymentMethod.findMany({
      where: { storeId: context.store.id },
      orderBy: { position: 'asc' },
    }),
  ]);

  const canManage = context.permissions.has('settings:manage');

  return (
    <>
      <PageHeader
        title="Réglages"
        description="Secteur, unités, TVA, stock et moyens de paiement de votre boutique."
      />
      <div className="space-y-6">
        <SectorSettingsPanel
          businessType={context.store.businessType}
          units={units.map((unit) => ({
            ...unit,
            defaultFactor: unit.defaultFactor ? toQty(unit.defaultFactor) : null,
          }))}
          canManage={canManage}
        />
        <TaxSettingsPanel
          taxEnabled={context.store.taxEnabled}
          taxRate={context.store.taxRate}
          canManage={canManage}
        />
        <StockSettingsPanel
          allowNegativeStock={context.store.allowNegativeStock}
          canManage={canManage}
        />
        <PaymentMethodsManager methods={paymentMethods} canManage={canManage} />
        <LanguageSettingsPanel language={context.store.language} canManage={canManage} />
        <NotificationSoundPanel
          notificationSoundUrl={context.store.notificationSoundUrl}
          canManage={canManage}
        />
      </div>
    </>
  );
}
