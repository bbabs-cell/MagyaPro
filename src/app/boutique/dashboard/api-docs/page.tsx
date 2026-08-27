import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { ApiDocs } from '@/components/boutique/api-docs';

export const metadata: Metadata = { title: 'API' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueApiDocsPage() {
  await requireStore('api:manage');

  return (
    <>
      <PageHeader
        title="Documentation de l'API"
        description="Créez une clé d'API dans Réglages, puis testez les requêtes directement ici."
      />
      <div className="rounded-2xl bg-surface-raised p-2">
        <ApiDocs />
      </div>
    </>
  );
}
