import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { env } from '@/lib/env';
import { generateQrDataUrl } from '@/lib/qrcode';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { TablesManager } from '@/components/dashboard/tables-manager';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Salle' };
export const dynamic = 'force-dynamic';

export default async function DiningRoomPage() {
  const context = await requireTenant('tables:view');

  const [tables, entitlements] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { position: 'asc' },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const enabled = hasFeature(entitlements, FEATURES.TABLE_SERVICE);
  const canManage = enabled && context.permissions.has('tables:manage');

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const publicUrl = `${env.appUrl}/r/${context.restaurant.slug}/table/${table.token}`;
      return {
        id: table.id,
        label: table.label,
        status: table.status,
        publicUrl,
        qrDataUrl: await generateQrDataUrl(publicUrl),
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Salle"
        description="Une table par QR code : vos clients y appellent le serveur, demandent l'addition, et commandent si vous l'activez."
      />

      {!enabled && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">
            Fonctionnalité non incluse dans votre plan
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Le service à table est disponible à partir des plans supérieurs.
          </p>
          <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
            Voir les plans
          </LinkButton>
        </Card>
      )}

      <TablesManager canManage={canManage} tables={tablesWithQr} />
    </>
  );
}
