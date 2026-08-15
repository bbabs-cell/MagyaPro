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
