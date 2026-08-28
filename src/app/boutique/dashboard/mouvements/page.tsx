import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import {
  MOVEMENTS_PAGE_SIZE,
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  isMovementType,
  listStockMovements,
} from '@/lib/boutique/movements';
import { Badge, Card, EmptyState, PageHeader, buttonClass, cx, inputClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Mouvements de stock' };
export const dynamic = 'force-dynamic';

/**
 * Historique des mouvements de stock.
 *
 * Chaque écriture de stock laissait déjà une trace complète en base ; il
 * manquait l'écran pour la lire. Sans lui, un écart d'inventaire ne peut ni
 * s'expliquer ni se défendre — c'est le premier reproche fait à un logiciel
 * de gestion.
 *
 * Formulaire en GET, sans JavaScript : les filtres restent dans l'URL, donc
 * partageables et rechargeables, et la page fonctionne sur une connexion
 * dégradée comme sur un vieux téléphone.
 */
export default async function StoreMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; du?: string; au?: string; page?: string }>;
}) {
  const context = await requireStore('inventory:view');
  const params = await searchParams;

  const type = params.type && isMovementType(params.type) ? params.type : undefined;
  const search = params.q?.trim() || undefined;
  const from = params.du?.trim() || undefined;
  const to = params.au?.trim() || undefined;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const { rows, total, pageCount } = await listStockMovements(context.store.id, {
    type,
    search,
    from,
    to,
    page,
  });

  const hasFilters = Boolean(type || search || from || to);
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (type) query.set('type', type);
    if (search) query.set('q', search);
    if (from) query.set('du', from);
    if (to) query.set('au', to);
    if (target > 1) query.set('page', String(target));
    const suffix = query.toString();
    return suffix ? `/boutique/dashboard/mouvements?${suffix}` : '/boutique/dashboard/mouvements';
  };

  return (
    <>
      <PageHeader
        title="Mouvements de stock"
        description="Chaque entrée et chaque sortie, avec son auteur et son motif. Rien n'est recalculé : c'est ce qui a été écrit au moment de l'opération."
      />

      <Card className="p-4 sm:p-5">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="lg:col-span-2">
            <span className="text-xs font-medium text-ink-muted">Produit</span>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ''}
              placeholder="Nom du produit"
              className={cx(inputClass, 'mt-1.5')}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-ink-muted">Type</span>
            <select name="type" defaultValue={type ?? ''} className={cx(inputClass, 'mt-1.5')}>
              <option value="">Tous les types</option>
              {MOVEMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {MOVEMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-medium text-ink-muted">Du</span>
            <input type="date" name="du" defaultValue={from ?? ''} className={cx(inputClass, 'mt-1.5')} />
          </label>
          <label>
            <span className="text-xs font-medium text-ink-muted">Au</span>
            <input type="date" name="au" defaultValue={to ?? ''} className={cx(inputClass, 'mt-1.5')} />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className={buttonClass('primary', 'md')}>
              Filtrer
            </button>
            {hasFilters ? (
              <a
                href="/boutique/dashboard/mouvements"
                className="rounded-lg px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                Tout afficher
              </a>
            ) : null}
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={hasFilters ? 'Aucun mouvement ne correspond' : 'Aucun mouvement enregistré'}
            description={
              hasFilters
                ? 'Élargissez la période ou retirez un filtre.'
                : "Les mouvements apparaîtront dès votre première réception, vente ou correction d'inventaire."
            }
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-ink-muted">
            {total} mouvement{total > 1 ? 's' : ''}
            {pageCount > 1 ? ` — page ${page} sur ${pageCount}` : ''}
          </p>

          <Card className="mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Mouvements de stock, du plus récent au plus ancien
              </caption>
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Produit</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Variation</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Stock après</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Auteur et motif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-surface-border last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                      {row.createdAt.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                      <span className="block text-xs">
                        {row.createdAt.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.productName}
                      {row.variantLabel ? (
                        <span className="block text-xs text-ink-muted">{row.variantLabel}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={row.change >= 0 ? 'success' : 'neutral'}>
                        {MOVEMENT_TYPE_LABELS[row.type]}
                      </Badge>
                    </td>
                    <td
                      className={cx(
                        'whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums',
                        row.change < 0 ? 'text-state-bad' : 'text-state-ok',
                      )}
                    >
                      {row.change > 0 ? '+' : ''}
                      {row.change} {row.unit}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {row.after}
                      <span className="block text-xs text-ink-muted">avant : {row.before}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {row.actor ?? 'Système'}
                      {row.reason ? <span className="block text-xs">{row.reason}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
              {page > 1 ? (
                <a
                  href={pageHref(page - 1)}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-raised"
                >
                  ← Précédent
                </a>
              ) : (
                <span />
              )}
              <span className="text-xs text-ink-muted">
                {MOVEMENTS_PAGE_SIZE} mouvements par page
              </span>
              {page < pageCount ? (
                <a
                  href={pageHref(page + 1)}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-raised"
                >
                  Suivant →
                </a>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
