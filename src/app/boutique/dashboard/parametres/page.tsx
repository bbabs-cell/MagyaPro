import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { STORE_FEATURES, getStoreEntitlements, hasStoreFeature } from '@/lib/boutique/entitlements';
import { cnameTarget, verificationRecordName } from '@/lib/domains';
import { PageHeader } from '@/components/ui';
import { PublishPanel } from '@/components/boutique/publish-panel';
import { DomainsManager } from '@/components/boutique/domains-manager';
import { TaxSettingsPanel } from '@/components/boutique/tax-settings-panel';

export const metadata: Metadata = { title: 'Réglages' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueSettingsPage() {
  const context = await requireStore('store:view');

  const [domains, entitlements] = await Promise.all([
    prisma.storeDomain.findMany({
      where: { storeId: context.store.id },
      orderBy: { createdAt: 'asc' },
    }),
    getStoreEntitlements(context.store.id),
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
