import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { getTenantContext } from '@/lib/tenant';
import { TEMPLATES } from '@/lib/templates/registry';
import { OnboardingWizard } from '@/components/onboarding/wizard';

export const metadata: Metadata = { title: 'Configuration de votre restaurant' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');

  const context = await getTenantContext();
  if (!context) redirect('/dashboard');

  // L'onboarding déjà terminé n'a plus de raison d'être : les mêmes réglages
  // restent modifiables depuis le dashboard.
  if (context.restaurant.onboardingCompletedAt) redirect('/dashboard');

  const [hours, categories, productCount] = await Promise.all([
    prisma.openingHour.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { dayOfWeek: 'asc' },
    }),
    prisma.category.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.product.count({ where: { restaurantId: context.restaurant.id } }),
  ]);

  const templates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
    select: { key: true, name: true, description: true },
  });

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="container-page max-w-3xl py-8 sm:py-12">
        <OnboardingWizard
          initialStep={context.restaurant.onboardingStep}
          restaurant={{
            id: context.restaurant.id,
            name: context.restaurant.name,
            slug: context.restaurant.slug,
            description: context.restaurant.description,
            logoUrl: context.restaurant.logoUrl,
            phone: context.restaurant.phone,
            email: context.restaurant.email,
            addressLine: context.restaurant.addressLine,
            city: context.restaurant.city,
            country: context.restaurant.country,
            facebookUrl: context.restaurant.facebookUrl,
            instagramUrl: context.restaurant.instagramUrl,
            tiktokUrl: context.restaurant.tiktokUrl,
            whatsappNumber: context.restaurant.whatsappNumber,
            templateKey: context.restaurant.templateKey,
            primaryColor: context.restaurant.primaryColor,
            secondaryColor: context.restaurant.secondaryColor,
            fontFamily: context.restaurant.fontFamily,
            currency: context.restaurant.currency,
          }}
          hours={hours.map((hour) => ({
            dayOfWeek: hour.dayOfWeek,
            isClosed: hour.isClosed,
            opensAt: hour.opensAt,
            closesAt: hour.closesAt,
          }))}
          categories={categories}
          productCount={productCount}
          templates={templates.map((template) => ({
            ...template,
            suggested:
              TEMPLATES.find((definition) => definition.key === template.key)
                ?.suggestedColors ?? null,
          }))}
        />
      </div>
    </div>
  );
}
