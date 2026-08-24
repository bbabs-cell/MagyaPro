import { prisma } from '@/lib/db';

export type ActiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
};

/**
 * Annonces actuellement dans leur fenêtre de publication, les plus récentes
 * en premier — filtrées par destinataire : une annonce peut être réservée à
 * Restaurant, à Boutique, ou visible des deux (`ALL`).
 */
export async function getActiveAnnouncements(
  audience: 'RESTAURANT' | 'STORE',
): Promise<ActiveAnnouncement[]> {
  const announcements = await prisma.platformAnnouncement.findMany({
    where: {
      publishedAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      audience: { in: [audience, 'ALL'] },
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
    select: { id: true, title: true, body: true, severity: true },
  });

  return announcements;
}
