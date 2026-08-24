import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/ui';
import { TwoFactorPanel } from '@/components/boutique/two-factor-panel';

export const metadata: Metadata = { title: 'Sécurité' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueSecurityPage() {
  const currentUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: currentUser.id },
    select: { totpEnabled: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sécurité"
        description="Protégez votre compte avec un second facteur de connexion."
      />
      <TwoFactorPanel enabled={user.totpEnabled} />
    </div>
  );
}
