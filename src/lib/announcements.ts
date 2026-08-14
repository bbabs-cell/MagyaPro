import { prisma } from '@/lib/db';

export type ActiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
};

/** Annonces actuellement dans leur fenêtre de publication, les plus récentes en premier. */
export async function getActiveAnnouncements(): Promise<ActiveAnnouncement[]> {
  const announcements = await prisma.platformAnnouncement.findMany({
    where: {
      publishedAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
    select: { id: true, title: true, body: true, severity: true },
  });

  return announcements;
}
