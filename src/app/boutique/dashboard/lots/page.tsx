import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { PageHeader, EmptyState, Card, Badge } from '@/components/ui';

export const metadata: Metadata = { title: 'Lots' };
export const dynamic = 'force-dynamic';

/**
 * Un lot n'existe que pour les entrées de stock où une date de péremption a
 * été renseignée (réception d'achat, stock initial) — un produit sans date
 * n'apparaît simplement pas ici, ce n'est pas une anomalie.
 */
export default async function BoutiqueLotsPage() {
  const context = await requireStore('inventory:view');

  const batches = await prisma.stockBatch.findMany({
    where: { storeId: context.store.id, remainingQuantity: { gt: 0 } },
    orderBy: { expiryDate: 'asc' },
    include: {
      productVariant: { select: { product: { select: { name: true, unit: true } } } },
      warehouse: { select: { name: true } },
    },
  });

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <>
      <PageHeader
        title="Lots"
        description="Stock suivi par date de péremption — uniquement les articles reçus avec une date renseignée."
      />

      {batches.length === 0 ? (
        <EmptyState
          title="Aucun lot suivi"
          description="Renseignez une date de péremption à la réception d'un achat ou à la création d'un produit pour qu'il apparaisse ici."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Entrepôt</th>
                <th className="px-4 py-3 text-right font-medium">Quantité restante</th>
                <th className="px-4 py-3 font-medium">Péremption</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const expired = batch.expiryDate < now;
                const expiringSoon = !expired && batch.expiryDate <= in30Days;
                return (
                  <tr key={batch.id} className="border-b border-surface-border last:border-0">
                    <td data-label="Produit" className="px-4 py-3 font-medium">
                      {batch.productVariant.product.name}
                    </td>
                    <td data-label="Entrepôt" className="px-4 py-3 text-ink-muted">
                      {batch.warehouse.name}
                    </td>
                    <td data-label="Quantité restante" className="px-4 py-3 text-right">
                      {batch.remainingQuantity}
                    </td>
                    <td data-label="Péremption" className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {batch.expiryDate.toLocaleDateString('fr-FR')}
                        {expired && <Badge tone="danger">Périmé</Badge>}
                        {expiringSoon && <Badge tone="warning">Bientôt</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
