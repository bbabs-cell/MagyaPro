import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { PublishPanel } from '@/components/boutique/publish-panel';

export const metadata: Metadata = { title: 'Réglages' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueSettingsPage() {
  const context = await requireStore('store:view');

  return (
    <>
      <PageHeader title="Réglages" description="Publication de votre boutique." />
      <PublishPanel
        status={context.store.status}
        slug={context.store.slug}
        canPublish={context.permissions.has('store:publish')}
      />
    </>
  );
}
