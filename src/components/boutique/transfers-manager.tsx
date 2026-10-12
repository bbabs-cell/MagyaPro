'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatCompositeStock, stepForUnit, type UnitOption } from '@/lib/boutique/units';
import type { TransferRow } from '@/lib/boutique/transfers-service';
import { AlertMessage, Badge, Button, Card, EmptyState, LinkButton, cx, inputClass } from '@/components/ui';

export type TransferProduct = {
  variantId: string;
  name: string;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  /** En unité de base. */
  stock: number;
  units: UnitOption[];
};

type Line = { variantId: string; unitId: string; quantity: string };

const STATUS: Record<TransferRow['status'], { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  PENDING: { label: 'Préparé', tone: 'neutral' },
  IN_TRANSIT: { label: 'En route', tone: 'warning' },
  RECEIVED: { label: 'Réceptionné', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function itemsSummary(items: TransferRow['items']) {
  return items
    .map((item) =>
      `${item.name} : ${item.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${item.unit}`.trim(),
    )
    .join(', ');
}

export function TransfersManager({
  storeName,
  transfers,
  destinations,
  products,
  canSend,
  canReceive,
}: {
  storeName: string;
  transfers: TransferRow[];
  destinations: Array<{ id: string; name: string }>;
  products: TransferProduct[];
  canSend: boolean;
  canReceive: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const incoming = transfers.filter((t) => t.direction === 'in' && t.status === 'IN_TRANSIT');
  const outgoing = transfers.filter((t) => t.direction === 'out' && t.status === 'IN_TRANSIT');
  const history = transfers.filter((t) => t.status !== 'IN_TRANSIT');

  async function act(transfer: TransferRow, action: 'reception' | 'annulation') {
    if (
      action === 'annulation' &&
      !window.confirm(`Annuler l'envoi vers ${transfer.otherStore} ? Le stock reviendra dans ${storeName}.`)
    ) {
      return;
    }
    setBusy(transfer.id);
    setError(null);
    setNotice(null);
    try {
      if (action === 'reception') {
        const result = await api.post<{ received: number; createdProducts: number }>(
          `/api/boutique/transferts/${encodeURIComponent(transfer.id)}/reception`,
        );
        setNotice(
          `Transfert réceptionné : ${result.received} produit${result.received > 1 ? 's' : ''} ajouté${result.received > 1 ? 's' : ''} au stock` +
            (result.createdProducts > 0
              ? `, dont ${result.createdProducts} nouvelle${result.createdProducts > 1 ? 's' : ''} fiche${result.createdProducts > 1 ? 's' : ''} créée${result.createdProducts > 1 ? 's' : ''} (prix repris de ${transfer.otherStore}).`
              : '.'),
        );
      } else {
        await api.post(`/api/boutique/transferts/${encodeURIComponent(transfer.id)}/annulation`);
        setNotice(`Envoi annulé : le stock est revenu dans ${storeName}.`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'opération n'a pas abouti.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <AlertMessage message={error} />
      {notice && (
        <p role="status" className="rounded-xl bg-state-ok-soft px-4 py-3 text-sm text-state-ok">
          {notice}
        </p>
      )}

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-ink">À réceptionner</h2>
          {incoming.map((transfer) => (
            <Card key={transfer.id} className="flex flex-col gap-3 border-l-4 border-l-state-warn p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Depuis {transfer.otherStore}</p>
                <p className="mt-0.5 text-xs text-ink-muted">Envoyé le {formatDate(transfer.sentAt)}</p>
                <p className="mt-1 text-sm text-ink">{itemsSummary(transfer.items)}</p>
                {transfer.note && <p className="mt-1 text-xs text-ink-muted">« {transfer.note} »</p>}
              </div>
              {canReceive && (
                <Button type="button" onClick={() => act(transfer, 'reception')} loading={busy === transfer.id} className="shrink-0">
                  Réceptionner
                </Button>
              )}
            </Card>
          ))}
          <p className="text-xs text-ink-muted">
            Réceptionnez quand la marchandise est arrivée et comptée : c&apos;est à ce moment qu&apos;elle entre dans votre stock.
          </p>
        </section>
      )}

      {canSend && destinations.length > 0 && !composing && (
        // Secondaire quand une réception attend : c'est elle, l'action du moment.
        <Button
          type="button"
          variant={incoming.length > 0 && canReceive ? 'secondary' : 'primary'}
          onClick={() => setComposing(true)}
        >
          + Nouveau transfert
        </Button>
      )}

      {composing && (
        <TransferForm
          storeName={storeName}
          destinations={destinations}
          products={products}
          onCancel={() => setComposing(false)}
          onSent={(message) => {
            setComposing(false);
            setNotice(message);
            router.refresh();
          }}
        />
      )}

      {canSend && destinations.length === 0 && (
        <EmptyState
          title="Une seule boutique"
          description="Les transferts déplacent du stock entre vos boutiques. Ajoutez une deuxième boutique, ou demandez l'accès à celle d'un associé, pour en faire."
          action={<LinkButton href="/boutique/dashboard/nouvelle-boutique">Ajouter une boutique</LinkButton>}
        />
      )}

      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-ink">En route</h2>
          {outgoing.map((transfer) => (
            <Card key={transfer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Vers {transfer.otherStore}</p>
                <p className="mt-0.5 text-xs text-ink-muted">Envoyé le {formatDate(transfer.sentAt)} · en attente de réception</p>
                <p className="mt-1 text-sm text-ink">{itemsSummary(transfer.items)}</p>
              </div>
              {canSend && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => act(transfer, 'annulation')}
                  loading={busy === transfer.id}
                  className="shrink-0"
                >
                  Annuler l&apos;envoi
                </Button>
              )}
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium text-ink">Historique</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun transfert terminé pour l&apos;instant.</p>
        ) : (
          <Card className="divide-y divide-surface-border">
            {history.map((transfer) => (
              <div key={transfer.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {transfer.direction === 'out' ? `Vers ${transfer.otherStore}` : `Depuis ${transfer.otherStore}`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{itemsSummary(transfer.items)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {formatDate(transfer.receivedAt ?? transfer.sentAt ?? transfer.createdAt)}
                  </p>
                </div>
                <Badge tone={STATUS[transfer.status].tone}>{STATUS[transfer.status].label}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function TransferForm({
  storeName,
  destinations,
  products,
  onCancel,
  onSent,
}: {
  storeName: string;
  destinations: Array<{ id: string; name: string }>;
  products: TransferProduct[];
  onCancel: () => void;
  onSent: (message: string) => void;
}) {
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? '');
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.variantId, p])), [products]);
  const chosen = new Set(lines.map((line) => line.variantId));

  const matches = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return [];
    return products
      .filter((p) => !chosen.has(p.variantId))
      .filter((p) =>
        [p.name, p.variantLabel, p.sku, p.barcode].filter(Boolean).some((value) => normalize(value!).includes(query)),
      )
      .slice(0, 8);
    // `chosen` dérive de `lines`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, lines]);

  function add(product: TransferProduct) {
    // Par défaut dans la plus grande unité (le carton) : c'est ainsi qu'on
    // déplace la marchandise d'une boutique à l'autre.
    const pack = product.units.filter((u) => !u.isBase && !u.isDecimal && u.factor > 1).sort((a, b) => b.factor - a.factor)[0];
    const base = product.units.find((u) => u.isBase) ?? product.units[0]!;
    setLines((current) => [...current, { variantId: product.variantId, unitId: (pack ?? base).unitId, quantity: '' }]);
    setSearch('');
  }

  function baseQuantity(line: Line): number {
    const product = byId.get(line.variantId);
    const unit = product?.units.find((u) => u.unitId === line.unitId);
    const value = Number(line.quantity.replace(',', '.'));
    if (!product || !unit || !Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value * unit.factor * 1_000_000) / 1_000_000;
  }

  const destination = destinations.find((d) => d.id === destinationId);
  const ready = lines.length > 0 && lines.every((line) => baseQuantity(line) > 0) && Boolean(destination);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await api.post('/api/boutique/transferts', {
        destinationStoreId: destinationId,
        items: lines.map((line) => ({ productVariantId: line.variantId, quantity: baseQuantity(line) })),
        note: note.trim() || undefined,
      });
      onSent(`Transfert envoyé vers ${destination?.name} : ${lines.length} produit${lines.length > 1 ? 's' : ''} en route. Il entrera dans leur stock à la réception.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le transfert n'a pas pu être envoyé.");
      setPending(false);
    }
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="font-medium text-ink">Nouveau transfert depuis {storeName}</h2>

      <label className="block">
        <span className="text-sm font-medium text-ink">Vers</span>
        <select
          value={destinationId}
          onChange={(event) => setDestinationId(event.target.value)}
          className={cx(inputClass, 'mt-1.5')}
        >
          {destinations.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-sm font-medium text-ink">Produits</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Chercher un produit à envoyer"
          aria-label="Chercher un produit à envoyer"
          className={cx(inputClass, 'mt-1.5')}
        />
        {matches.length > 0 && (
          <ul className="mt-1 divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
            {matches.map((product) => (
              <li key={product.variantId}>
                <button
                  type="button"
                  onClick={() => add(product)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-sunken"
                >
                  <span className="min-w-0 truncate">
                    {product.name}
                    {product.variantLabel && <span className="text-ink-muted"> · {product.variantLabel}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">{formatCompositeStock(product.stock, product.units)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="space-y-2">
          {lines.map((line, index) => {
            const product = byId.get(line.variantId)!;
            const unit = product.units.find((u) => u.unitId === line.unitId) ?? product.units[0]!;
            const quantity = baseQuantity(line);
            const tooMuch = quantity > product.stock;
            return (
              <li key={line.variantId} className="rounded-xl border border-surface-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-medium text-ink">
                    {product.name}
                    {product.variantLabel && <span className="font-normal text-ink-muted"> · {product.variantLabel}</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Retirer ${product.name}`}
                    className="shrink-0 px-1 text-ink-faint hover:text-state-bad"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    inputMode={unit.isDecimal ? 'decimal' : 'numeric'}
                    min={0}
                    step={unit.isDecimal ? 'any' : stepForUnit(unit)}
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((l, i) => (i === index ? { ...l, quantity: event.target.value } : l)),
                      )
                    }
                    aria-label={`Quantité de ${product.name}`}
                    className={cx(inputClass, 'max-w-[6rem] text-center tabular-nums')}
                  />
                  {product.units.length > 1 ? (
                    <select
                      value={line.unitId}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((l, i) => (i === index ? { ...l, unitId: event.target.value } : l)),
                        )
                      }
                      aria-label={`Unité pour ${product.name}`}
                      className={cx(inputClass, 'max-w-[11rem]')}
                    >
                      {product.units.map((u) => (
                        <option key={u.unitId} value={u.unitId}>
                          {u.labelPlural}
                          {u.isBase ? '' : ` (${u.factor})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-ink-muted">{unit.labelPlural}</span>
                  )}
                  <span className={cx('text-xs', tooMuch ? 'text-state-bad' : 'text-ink-muted')}>
                    En stock : {formatCompositeStock(product.stock, product.units)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <label className="block">
        <span className="text-sm font-medium text-ink">Note (facultatif)</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder="Ex. livré par Moussa en moto"
          className={cx(inputClass, 'mt-1.5')}
        />
      </label>

      <AlertMessage message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="button" onClick={submit} loading={pending} disabled={!ready}>
          Envoyer vers {destination?.name ?? '…'}
        </Button>
      </div>
    </Card>
  );
}
