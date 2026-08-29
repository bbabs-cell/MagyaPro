import { prisma } from '@/lib/db';

/**
 * Réglages globaux de la plateforme — ligne unique (`platform_settings`).
 * Aujourd'hui limité aux numéros receveurs des paiements d'abonnement.
 */
export async function getPlatformSettings() {
  return prisma.platformSettings.findFirst();
}

export async function updatePlatformSettings(input: {
  waveNumber?: string | null;
  orangeMoneyNumber?: string | null;
  promoDiscountPercent?: number | null;
  promoEndsAt?: Date | null;
  promoLabel?: string | null;
  notificationSoundUrl?: string | null;
  additionalStorePercent?: number;
}) {
  const existing = await prisma.platformSettings.findFirst({ select: { id: true } });

  if (existing) {
    return prisma.platformSettings.update({
      where: { id: existing.id },
      data: input,
    });
  }

  return prisma.platformSettings.create({ data: input });
}

/**
 * Offre de lancement active, ou `null` si aucune n'est configurée ou que sa
 * date de fin est dépassée — un seul endroit à consulter pour l'affichage du
 * bandeau comme pour le calcul de la remise.
 */
export async function getActivePromo() {
  const settings = await getPlatformSettings();
  if (!settings?.promoDiscountPercent || !settings.promoEndsAt) return null;
  if (settings.promoEndsAt.getTime() <= Date.now()) return null;

  return {
    discountPercent: settings.promoDiscountPercent,
    endsAt: settings.promoEndsAt,
    label: settings.promoLabel,
  };
}
