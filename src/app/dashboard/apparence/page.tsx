import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { PREMIUM_TEMPLATE_KEYS, TEMPLATES } from '@/lib/templates/registry';
import { AppearanceForm } from '@/components/dashboard/appearance-form';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Apparence' };
export const dynamic = 'force-dynamic';

export default async function AppearancePage() {
  const context = await requireTenant('restaurant:update');

  const [templates, entitlements] = await Promise.all([
    prisma.template.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const premiumAllowed = hasFeature(entitlements, FEATURES.PREMIUM_TEMPLATES);

  return (
    <>
      <PageHeader
        title="Apparence"
        description="Template, couleurs et images de votre site. Changer de template ne supprime aucune donnée."
      />

      <AppearanceForm
        restaurant={{
          slug: context.restaurant.slug,
          templateKey: context.restaurant.templateKey,
          primaryColor: context.restaurant.primaryColor,
          secondaryColor: context.restaurant.secondaryColor,
          fontFamily: context.restaurant.fontFamily,
          logoUrl: context.restaurant.logoUrl,
          coverUrl: context.restaurant.coverUrl,
          faviconUrl: context.restaurant.faviconUrl,
        }}
        templates={templates.map((template) => ({
          key: template.key,
          name: template.name,
          description: template.description,
          isPremium: PREMIUM_TEMPLATE_KEYS.has(template.key),
          locked: PREMIUM_TEMPLATE_KEYS.has(template.key) && !premiumAllowed,
          suggested:
            TEMPLATES.find((definition) => definition.key === template.key)
              ?.suggestedColors ?? null,
        }))}
      />
    </>
  );
}
