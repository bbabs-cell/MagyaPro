import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { formatQty } from '@/lib/boutique/quantity';
import { UNIT_LABELS } from '@/lib/boutique/units';
import { EXPIRY_LABELS, expiryState, type ExpiryState } from '@/lib/boutique/expiry';
import { PageHeader, EmptyState, Card, Badge } from '@/components/ui';

export const metadata: Metadata = { title: 'Dates de péremption' };
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

  // Mêmes seuils que la fiche produit et que la caisse. Cet écran appliquait
  // les siens — périmé, ou « bientôt » à trente jours — et ignorait donc l'état
  // critique des sept derniers jours. Le même lot s'affichait en orange ici et
  // en rouge sur la fiche produit.
  const now = Date.now();
  const counts: Record<Exclude<ExpiryState, 'ok'>, number> = { expired: 0, critical: 0, soon: 0 };
  for (const batch of batches) {
    const state = expiryState(batch.expiryDate, now);
    if (state !== 'ok') counts[state] += 1;
  }

  return (
    <>
      <PageHeader
        title="Dates de péremption"
        description="Stock suivi par date de péremption — uniquement les articles reçus avec une date renseignée."
      />

      {batches.length === 0 ? (
        <EmptyState
          title="Aucun lot suivi"
          description="Renseignez une date de péremption à la réception d'un achat ou à la création d'un produit pour qu'il apparaisse ici."
        />
      ) : (
        <>
          {/* Ce qu'il faut écouler, avant la liste. Un tableau trié par date
              oblige à compter soi-même combien de lots sont déjà perdus. */}
          {counts.expired + counts.critical + counts.soon > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2 text-sm">
              {counts.expired > 0 && (
                <li className="rounded-lg bg-state-bad-soft px-3 py-1.5 font-medium text-state-bad">
                  {counts.expired} lot{counts.expired > 1 ? 's' : ''} périmé
                  {counts.expired > 1 ? 's' : ''}
                </li>
              )}
              {counts.critical > 0 && (
                <li className="rounded-lg bg-state-bad-soft px-3 py-1.5 font-medium text-state-bad">
                  {counts.critical} à écouler sous 7 jours
                </li>
              )}
              {counts.soon > 0 && (
                <li className="rounded-lg bg-state-warn-soft px-3 py-1.5 font-medium text-state-warn">
                  {counts.soon} sous 30 jours
                </li>
              )}
            </ul>
          )}

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
                const state = expiryState(batch.expiryDate, now);
                return (
                  <tr key={batch.id} className="border-b border-surface-border last:border-0">
                    <td data-label="Produit" className="px-4 py-3 font-medium">
                      {batch.productVariant.product.name}
                    </td>
                    <td data-label="Entrepôt" className="px-4 py-3 text-ink-muted">
                      {batch.warehouse.name}
                    </td>
                    <td data-label="Quantité restante" className="px-4 py-3 text-right">
                      {formatQty(batch.remainingQuantity)}{' '}
                      {UNIT_LABELS[batch.productVariant.product.unit]}
                    </td>
                    <td data-label="Péremption" className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {batch.expiryDate.toLocaleDateString('fr-FR')}
                        {state !== 'ok' && (
                          <Badge tone={state === 'soon' ? 'warning' : 'danger'}>
                            {EXPIRY_LABELS[state]}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </Card>
        </>
      )}
    </>
  );
}
