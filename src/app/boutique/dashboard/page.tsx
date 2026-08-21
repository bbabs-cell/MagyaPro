import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import { Card, PageHeader, StatCard } from '@/components/ui';

export const metadata: Metadata = { title: "Vue d'ensemble" };
export const dynamic = 'force-dynamic';

/**
 * Vue d'ensemble — première version. Les indicateurs affichés sont réels
 * (comptés en base), pas des exemples : à ce stade du produit, ils valent
 * tous zéro pour une boutique neuve, et c'est normal — rien n'est simulé en
 * attendant les fonctionnalités qui les feraient bouger (produits, ventes).
 */
export default async function BoutiqueDashboardPage() {
  const context = await requireStore('store:view');

  const [productCount, saleCount, customerCount] = await Promise.all([
    prisma.storeProduct.count({ where: { storeId: context.store.id } }),
    prisma.sale.count({ where: { storeId: context.store.id } }),
    prisma.storeCustomer.count({ where: { storeId: context.store.id } }),
  ]);

  return (
    <>
      <PageHeader
        title={`Bonjour, ${context.store.name}`}
        description={`Connecté en tant que ${STORE_ROLE_LABELS[context.role]}.`}
      />

      <section aria-label="Indicateurs clés" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Produits" value={String(productCount)} />
        <StatCard label="Ventes" value={String(saleCount)} />
        <StatCard label="Clients" value={String(customerCount)} />
      </section>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-ink">Bientôt disponible</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Le catalogue produits, la caisse (POS), le suivi de stock et les
          ventes arrivent dans les prochaines mises à jour. Votre compte et
          votre boutique « {context.store.name} » sont déjà prêts à les
          recevoir.
        </p>
      </Card>
    </>
  );
}
