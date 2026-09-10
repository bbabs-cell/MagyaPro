import type { Metadata } from 'next';

import { requireStore } from '@/lib/boutique/store-tenant';
import { SALES_PAGE_SIZE, listStoreSales } from '@/lib/boutique/sales-history';
import { SALE_STATUS_LABELS, isSaleStatus } from '@/lib/boutique/labels';
import { formatMoney } from '@/lib/money';
import { Card, EmptyState, PageHeader, buttonClass, cx, inputClass } from '@/components/ui';
import { SalesManager } from '@/components/boutique/sales-manager';

export const metadata: Metadata = { title: 'Ventes' };
export const dynamic = 'force-dynamic';

/**
 * Journal des ventes.
 *
 * L'écran montrait les cent dernières ventes, sans recherche ni période, et
 * sans moyen d'atteindre la cent unième. Or on ouvre cet écran pour retrouver
 * une vente précise : celle du client qui revient avec un article, celle dont
 * il faut rééditer la facture, celle d'hier qu'on veut vérifier.
 *
 * Mêmes principes que l'historique des mouvements : filtres en GET, donc dans
 * l'URL — partageables, rechargeables, et fonctionnels sans JavaScript sur un
 * téléphone à connexion lente.
 */
export default async function BoutiqueSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string; du?: string; au?: string; page?: string }>;
}) {
  const context = await requireStore('sales:view');
  const params = await searchParams;

  const status = params.statut && isSaleStatus(params.statut) ? params.statut : undefined;
  const search = params.q?.trim() || undefined;
  const from = params.du?.trim() || undefined;
  const to = params.au?.trim() || undefined;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const { rows, total, revenue, pageCount } = await listStoreSales(context.store.id, {
    status,
    search,
    from,
    to,
    page,
  });

  const hasFilters = Boolean(status || search || from || to);
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (status) query.set('statut', status);
    if (search) query.set('q', search);
    if (from) query.set('du', from);
    if (to) query.set('au', to);
    if (target > 1) query.set('page', String(target));
    const suffix = query.toString();
    return suffix ? `/boutique/dashboard/ventes?${suffix}` : '/boutique/dashboard/ventes';
  };

  return (
    <>
      <PageHeader
        title="Ventes"
        description="Retrouvez une vente, rééditez sa facture, enregistrez un retour."
      />

      <Card className="p-4 sm:p-5">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="lg:col-span-2">
            <span className="text-xs font-medium text-ink-muted">Numéro ou produit</span>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ''}
              placeholder="412, ou « riz »"
              className={cx(inputClass, 'mt-1.5')}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-ink-muted">Statut</span>
            <select name="statut" defaultValue={status ?? ''} className={cx(inputClass, 'mt-1.5')}>
              <option value="">Tous les statuts</option>
              {Object.entries(SALE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
                href="/boutique/dashboard/ventes"
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
            title={hasFilters ? 'Aucune vente ne correspond' : 'Aucune vente pour le moment'}
            description={
              hasFilters
                ? 'Élargissez la période ou retirez un filtre.'
                : 'Les ventes réalisées depuis la caisse apparaîtront ici.'
            }
          />
        </div>
      ) : (
        <>
          {/* Le total porte sur la sélection entière, pas sur la page affichée :
              filtrer sur hier doit donner le chiffre d'hier. Les ventes
              annulées en sont exclues, elles n'ont rien encaissé. */}
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-sm text-ink-muted">
              {total} vente{total > 1 ? 's' : ''}
              {pageCount > 1 ? ` · page ${page} sur ${pageCount}` : ''}
            </p>
            <p className="text-sm text-ink-muted">
              Encaissé :{' '}
              <span className="font-semibold text-ink">
                {formatMoney(revenue, context.store.currency)}
              </span>
            </p>
          </div>

          <div className="mt-3">
            <SalesManager sales={rows} currency={context.store.currency} />
          </div>

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
              <span className="text-xs text-ink-muted">{SALES_PAGE_SIZE} ventes par page</span>
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
