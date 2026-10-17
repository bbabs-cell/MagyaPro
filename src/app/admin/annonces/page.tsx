import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { AnnouncementManager } from '@/components/admin/announcement-manager';
import { DomainHeading } from '@/components/admin/domain';

export const metadata: Metadata = { title: 'Annonces' };
export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  await requireSuperAdmin();

  const announcements = await prisma.platformAnnouncement.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <div>
        <DomainHeading as="h1" domain="comm" className="text-2xl font-semibold tracking-tight">
          Annonces plateforme
        </DomainHeading>
        <p className="mt-1 text-sm text-fg/60">
          Visibles dans le dashboard des restaurants et/ou des boutiques
          concernés (voir « Destinataires ») tant qu&apos;elles ne sont pas
          expirées.
        </p>
      </div>

      <div className="mt-6">
        <AnnouncementManager
          initial={announcements.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            severity: a.severity,
            audience: a.audience,
            publishedAt: a.publishedAt.toISOString(),
            expiresAt: a.expiresAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </>
  );
}
