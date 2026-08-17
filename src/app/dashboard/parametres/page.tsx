import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { configurableProviders } from '@/lib/payments/registry';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { cnameTarget, verificationRecordName } from '@/lib/domains';
import { SettingsPanels } from '@/components/dashboard/settings-panels';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Réglages' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const context = await requireTenant('settings:manage');

  const [settings, hours, domains, entitlements] = await Promise.all([
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: context.restaurant.id },
    }),
    prisma.openingHour.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { dayOfWeek: 'asc' },
    }),
    prisma.domain.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { createdAt: 'asc' },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  return (
    <>
      <PageHeader
        title="Réglages"
        description="Informations du restaurant, horaires, commandes, référencement et domaines."
      />

      <SettingsPanels
        canPublish={context.permissions.has('restaurant:publish')}
        customDomainAllowed={hasFeature(entitlements, FEATURES.CUSTOM_DOMAIN)}
        restaurant={{
          id: context.restaurant.id,
          slug: context.restaurant.slug,
          status: context.restaurant.status,
          name: context.restaurant.name,
          description: context.restaurant.description,
          phone: context.restaurant.phone,
          email: context.restaurant.email,
          addressLine: context.restaurant.addressLine,
          city: context.restaurant.city,
          country: context.restaurant.country,
          latitude: context.restaurant.latitude,
          longitude: context.restaurant.longitude,
          facebookUrl: context.restaurant.facebookUrl,
          instagramUrl: context.restaurant.instagramUrl,
          tiktokUrl: context.restaurant.tiktokUrl,
          whatsappNumber: context.restaurant.whatsappNumber,
          seoTitle: context.restaurant.seoTitle,
          seoDescription: context.restaurant.seoDescription,
          seoImageUrl: context.restaurant.seoImageUrl,
          currency: context.restaurant.currency,
        }}
        settings={{
          orderingEnabled: settings?.orderingEnabled ?? true,
          deliveryEnabled: settings?.deliveryEnabled ?? true,
          pickupEnabled: settings?.pickupEnabled ?? true,
          tableOrderingEnabled: settings?.tableOrderingEnabled ?? false,
          minOrderAmount: settings?.minOrderAmount ?? 0,
          prepTimeMinutes: settings?.prepTimeMinutes ?? 30,
          paymentProviders: settings?.paymentProviders ?? [],
          orangeMoneyNumber: settings?.orangeMoneyNumber ?? null,
          waveNumber: settings?.waveNumber ?? null,
          notificationEmail: settings?.notificationEmail ?? null,
          notificationSoundUrl: settings?.notificationSoundUrl ?? null,
          reservationGraceMinutes: settings?.reservationGraceMinutes ?? 60,
          taxEnabled: settings?.taxEnabled ?? false,
          taxRate: settings?.taxRate ?? null,
          taxLabel: settings?.taxLabel ?? 'TVA',
          googleAnalyticsId: settings?.googleAnalyticsId ?? null,
          metaPixelId: settings?.metaPixelId ?? null,
        }}
        hours={hours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          isClosed: hour.isClosed,
          opensAt: hour.opensAt,
          closesAt: hour.closesAt,
        }))}
        providers={configurableProviders()}
        domains={domains.map((domain) => ({
          id: domain.id,
          hostname: domain.hostname,
          type: domain.type,
          status: domain.status,
          verificationToken: domain.verificationToken,
          recordName: verificationRecordName(domain.hostname),
        }))}
        cnameTarget={cnameTarget()}
      />
    </>
  );
}
