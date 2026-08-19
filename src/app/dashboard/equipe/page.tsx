import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { FEATURES, getEntitlements, hasFeature } from '@/lib/entitlements';
import { PERMISSIONS, PERMISSION_LABELS, permissionsForRole } from '@/lib/rbac';
import { TeamManager } from '@/components/dashboard/team-manager';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Équipe' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const context = await requireTenant('team:view');

  const [members, entitlements] = await Promise.all([
    prisma.restaurantUser.findMany({
      where: { restaurantId: context.restaurant.id },
      include: {
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    getEntitlements(context.restaurant.id),
  ]);

  const multiUser = hasFeature(entitlements, FEATURES.MULTIPLE_USERS);

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Donnez un accès limité à votre personnel. Chaque rôle ouvre exactement les rubriques dont il a besoin."
      />

      {!multiUser && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">
            Comptes multiples non inclus
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Votre plan actuel ne permet qu&apos;un seul compte. Les plans
            supérieurs vous permettent d&apos;ajouter votre équipe.
          </p>
          <LinkButton href="/dashboard/abonnement" size="sm" className="mt-3">
            Voir les plans
          </LinkButton>
        </Card>
      )}

      <TeamManager
        canManage={context.permissions.has('team:manage') && multiUser}
        currentUserId={context.user.id}
        maxUsers={entitlements.limits.maxUsers}
        permissions={PERMISSIONS.map((permission) => ({
          value: permission,
          label: PERMISSION_LABELS[permission],
        }))}
        rolePermissions={{
          ADMIN: permissionsForRole('ADMIN'),
          EMPLOYEE: permissionsForRole('EMPLOYEE'),
          COURIER: permissionsForRole('COURIER'),
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
