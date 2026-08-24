import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { getStoreTemplates } from '@/lib/boutique/store-templates';
import { storeTemplatePreviewUrl } from '@/lib/storage';
import { AppearanceForm } from '@/components/boutique/appearance-form';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Apparence' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueAppearancePage() {
  const context = await requireStore('settings:manage');

  const templates = await getStoreTemplates();

  return (
    <>
      <PageHeader
        title="Apparence"
        description="Template, couleurs et images du site public de votre boutique. Changer de template ne supprime aucune donnée."
      />

      <AppearanceForm
        store={{
          slug: context.store.slug,
          templateKey: context.store.templateKey,
          primaryColor: context.store.primaryColor,
          secondaryColor: context.store.secondaryColor,
          fontFamily: context.store.fontFamily,
          logoUrl: context.store.logoUrl,
          coverUrl: context.store.coverUrl,
          faviconUrl: context.store.faviconUrl,
        }}
        templates={templates.map((template) => ({
          key: template.key,
          name: template.name,
          description: template.description,
          previewImageUrl: storeTemplatePreviewUrl(template.key),
        }))}
      />
    </>
  );
}
