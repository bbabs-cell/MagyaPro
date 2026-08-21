import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader } from '@/components/ui';
import { CustomersManager } from '@/components/boutique/customers-manager';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function BoutiqueCustomersPage() {
  const context = await requireStore('customers:view');

  const customers = await prisma.storeCustomer.findMany({
    where: { storeId: context.store.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      salesCount: true,
      totalSpent: true,
      creditBalance: true,
      creditLimit: true,
    },
  });

  return (
    <>
      <PageHeader title="Clients" description="Fichier client et suivi du crédit." />
      <CustomersManager
        initialCustomers={customers}
        currency={context.store.currency}
        canManage={context.permissions.has('customers:manage')}
        canManageCredit={context.permissions.has('credits:manage')}
      />
    </>
  );
}
