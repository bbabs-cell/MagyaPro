import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { STORE_FEATURES, getStoreEntitlements, hasStoreFeature } from '@/lib/boutique/entitlements';
import { cnameTarget, verificationRecordName } from '@/lib/domains';
import { PageHeader } from '@/components/ui';
import { PublishPanel } from '@/components/boutique/publish-panel';
import { DomainsManager } from '@/components/boutique/domains-manager';
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
  const units = await prisma.storeUnit.findMany({
    where: { storeId: context.store.id },
    orderBy: [{ isActive: 'desc' }, { position: 'asc' }],
  });

  const [domains, entitlements, paymentMethods] = await Promise.all([
    prisma.storeDomain.findMany({
      where: { storeId: context.store.id },
      orderBy: { createdAt: 'asc' },
    }),
    getStoreEntitlements(context.store.id),
    prisma.storePaymentMethod.findMany({
      where: { storeId: context.store.id },
      orderBy: { position: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader title="Réglages" description="Publication et domaines de votre boutique." />
      <div className="space-y-6">
        <PublishPanel
          status={context.store.status}
          slug={context.store.slug}
          canPublish={context.permissions.has('store:publish')}
        />
        <TaxSettingsPanel
          taxEnabled={context.store.taxEnabled}
          taxRate={context.store.taxRate}
          canManage={context.permissions.has('settings:manage')}
        />
        <LanguageSettingsPanel
          language={context.store.language}
          canManage={context.permissions.has('settings:manage')}
        />
        <SectorSettingsPanel
          businessType={context.store.businessType}
          units={units.map((unit) => ({
            ...unit,
            defaultFactor: unit.defaultFactor ? toQty(unit.defaultFactor) : null,
          }))}
          canManage={context.permissions.has('settings:manage')}
        />
        <StockSettingsPanel
          allowNegativeStock={context.store.allowNegativeStock}
          canManage={context.permissions.has('settings:manage')}
        />
        <NotificationSoundPanel
          notificationSoundUrl={context.store.notificationSoundUrl}
          canManage={context.permissions.has('settings:manage')}
        />
        <PaymentMethodsManager
          methods={paymentMethods}
          canManage={context.permissions.has('settings:manage')}
        />
        <DomainsManager
          domains={domains.map((domain) => ({
            ...domain,
            recordName: verificationRecordName(domain.hostname),
          }))}
          cnameTarget={cnameTarget()}
          canManage={
            context.permissions.has('settings:manage') &&
            hasStoreFeature(entitlements, STORE_FEATURES.CUSTOM_DOMAIN)
          }
        />
      </div>
    </>
  );
}
