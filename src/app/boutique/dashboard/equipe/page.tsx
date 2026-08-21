import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import {
  STORE_PERMISSIONS,
  STORE_PERMISSION_LABELS,
  permissionsForStoreRole,
} from '@/lib/boutique/rbac';
import { StoreTeamManager } from '@/components/boutique/team-manager';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Équipe' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueTeamPage() {
  const context = await requireStore('employees:view');

  const members = await prisma.storeUser.findMany({
    where: { storeId: context.store.id },
    include: {
      user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Donnez un accès limité à votre personnel. Chaque rôle ouvre exactement les rubriques dont il a besoin."
      />

      <StoreTeamManager
        canManage={context.permissions.has('employees:manage')}
        currentUserId={context.user.id}
        permissions={STORE_PERMISSIONS.map((permission) => ({
          value: permission,
          label: STORE_PERMISSION_LABELS[permission],
        }))}
        rolePermissions={{
          ADMIN: permissionsForStoreRole('ADMIN'),
          MANAGER: permissionsForStoreRole('MANAGER'),
          CASHIER: permissionsForStoreRole('CASHIER'),
          SALESPERSON: permissionsForStoreRole('SALESPERSON'),
          STOCK_MANAGER: permissionsForStoreRole('STOCK_MANAGER'),
          ACCOUNTANT: permissionsForStoreRole('ACCOUNTANT'),
        }}
        members={members.map((member) => ({
          id: member.id,
          role: member.role,
          extraPermissions: member.extraPermissions,
          userId: member.user.id,
          name: member.user.name,
          email: member.user.email,
          lastLoginAt: member.user.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
