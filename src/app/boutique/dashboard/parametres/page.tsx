import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { STORE_FEATURES, getStoreEntitlements, hasStoreFeature } from '@/lib/boutique/entitlements';
import { cnameTarget, verificationRecordName } from '@/lib/domains';
import { PageHeader } from '@/components/ui';
import { PublishPanel } from '@/components/boutique/publish-panel';
import { DomainsManager } from '@/components/boutique/domains-manager';
import { TaxSettingsPanel } from '@/components/boutique/tax-settings-panel';
import { ApiKeysManager } from '@/components/boutique/api-keys-manager';
import { WebhooksManager } from '@/components/boutique/webhooks-manager';

export const metadata: Metadata = { title: 'Réglages' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueSettingsPage() {
  const context = await requireStore('store:view');

  const canManageApi = context.permissions.has('api:manage');

  const [domains, entitlements, apiKeys, webhooks] = await Promise.all([
    prisma.storeDomain.findMany({
      where: { storeId: context.store.id },
      orderBy: { createdAt: 'asc' },
    }),
    getStoreEntitlements(context.store.id),
    canManageApi
      ? prisma.storeApiKey.findMany({
          where: { storeId: context.store.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    canManageApi
      ? prisma.storeWebhook.findMany({
          where: { storeId: context.store.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, url: true, events: true, isActive: true, createdAt: true },
        })
      : Promise.resolve([]),
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
        {canManageApi && (
          <>
            <ApiKeysManager
              apiKeys={apiKeys.map((key) => ({
                ...key,
                lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
                revokedAt: key.revokedAt?.toISOString() ?? null,
                createdAt: key.createdAt.toISOString(),
              }))}
              canManage={canManageApi}
            />
            <WebhooksManager
              webhooks={webhooks.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() }))}
              canManage={canManageApi}
            />
          </>
        )}
      </div>
    </>
  );
}
