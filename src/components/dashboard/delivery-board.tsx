'use client';

import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { formatMoney, toMinor } from '@/lib/money';
import {
  COLLECTION_METHODS,
  type CollectionOutcome,
} from '@/lib/orders/delivery-collection';
import { AlertMessage, Badge, Button, Card, Field, cx, inputClass } from '@/components/ui';

type DeliveryOrder = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  total: number;
  currency: string;
  placedAt: string;
  statusUpdatedAt: string;
  /** Ce qu'il reste réellement à percevoir : zéro si la commande est déjà réglée. */
  amountDue: number;
};

/**
 * Ce que le livreur déclare, par commande, avant de confirmer la remise.
 *
 * Tenu à l'écart de la commande elle-même : c'est une saisie en cours, pas un
 * fait. Rien n'est enregistré tant que le code n'a pas été validé.
 */
type Declaration = { outcome: CollectionOutcome; amount: string; method: string };

const DEFAULT_DECLARATION: Declaration = {
  outcome: 'full',
  amount: '',
  method: COLLECTION_METHODS[0].id,
};

const POLL_INTERVAL_MS = 15_000;
/** Espacement minimum entre deux envois de position : `watchPosition` peut
 * déclencher bien plus souvent que nécessaire (à chaque petit mouvement). */
const POSITION_SEND_INTERVAL_MS = 20_000;

function mapsUrl(order: DeliveryOrder): string {
  if (order.deliveryLat !== null && order.deliveryLng !== null) {
    return `https://www.openstreetmap.org/directions?to=${order.deliveryLat},${order.deliveryLng}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(order.deliveryAddress ?? '')}`;
}

export function DeliveryBoard({
  initialPool,
  initialMine,
}: {
  initialPool: DeliveryOrder[];
  initialMine: DeliveryOrder[];
}) {
  const [pool, setPool] = useState(initialPool);
  const [mine, setMine] = useState(initialMine);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [declarations, setDeclarations] = useState<Record<string, Declaration>>({});
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAtRef = useRef(0);
  const mutation = useServerMutation();
  /**
   * Le relevé périodique est suspendu pendant qu'une prise en charge ou une
   * confirmation est en cours.
   *
   * Une réponse partie avant l'appui arrive après lui et rapporte l'état
   * d'avant : la course tout juste prise réapparaissait alors dans la liste
   * « à prendre », et le livreur la reprenait — ou croyait l'avoir perdue au
   * profit d'un collègue.
   */
  const inFlightRef = useRef(0);

  // Partage de position : actif tant qu'au moins une livraison est en
  // cours. `watchPosition` reste ouvert en continu (plus réactif qu'un
  // sondage), mais l'envoi au serveur est espacé pour ne pas multiplier les
  // requêtes à chaque micro-déplacement.
  useEffect(() => {
    if (mine.length === 0 || !('geolocation' in navigator)) {
      setSharingLocation(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setSharingLocation(true);
        setLocationDenied(false);
        const now = Date.now();
        if (now - lastSentAtRef.current < POSITION_SEND_INTERVAL_MS) return;
        lastSentAtRef.current = now;
        api
          .post('/api/livraisons/position', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          .catch(() => {
            // Une position manquée n'est pas grave : la suivante suffira.
          });
      },
      () => {
        setSharingLocation(false);
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mine.length]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get<{ pool: DeliveryOrder[]; mine: DeliveryOrder[] }>('/api/livraisons');
        if (!cancelled && inFlightRef.current === 0) {
          setPool(data.pool);
          setMine(data.mine);
        }
      } catch {
        // Une erreur ponctuelle n'efface pas l'écran : nouvel essai au tour suivant.
      }
      if (!cancelled) timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function claim(order: DeliveryOrder) {
    mutation.run(
      async () => {
        inFlightRef.current += 1;
        try {
          // Course entre livreurs : deux d'entre eux peuvent viser la même
          // commande. La liste n'est donc pas déplacée d'avance — c'est le
          // serveur qui tranche, et lui seul. Un déplacement anticipé
          // annoncerait au perdant une course qu'il n'a pas obtenue.
          await api.post(`/api/livraisons/${order.id}/prendre`, {});
          setPool((current) => current.filter((o) => o.id !== order.id));
          setMine((current) => [...current, order]);
        } finally {
          inFlightRef.current -= 1;
        }
      },
      {
        key: order.id,
        skipRefresh: true,
        successMessage: 'Livraison prise en charge.',
        failureMessage: "Cette livraison n'a pas pu être prise en charge.",
      },
    );
  }

  function confirm(order: DeliveryOrder) {
    const code = (codeInputs[order.id] ?? '').trim();
    const declared = declarations[order.id] ?? DEFAULT_DECLARATION;
    const owed = order.amountDue > 0;

    // Le montant partiel est saisi en unité majeure — « 3000 » — et converti
    // ici comme partout ailleurs. `toMinor` lève sur une saisie illisible ;
    // dans ce cas on n'envoie rien et le serveur répond « indiquez le montant
    // reçu », plutôt que de laisser passer un `NaN`.
    let partialAmount: number | null = null;
    try {
      partialAmount = toMinor(declared.amount, order.currency);
    } catch {
      partialAmount = null;
    }

    mutation.run(
      async () => {
        inFlightRef.current += 1;
        try {
          await api.post(`/api/livraisons/${order.id}/livrer`, {
            code,
            // Rien à déclarer sur une commande déjà réglée en ligne.
            collection: owed
              ? {
                  outcome: declared.outcome,
                  ...(declared.outcome === 'partial' && partialAmount !== null
                    ? { amount: partialAmount }
                    : {}),
                  ...(declared.outcome === 'none' ? {} : { method: declared.method }),
                }
              : undefined,
          });
          setMine((current) => current.filter((o) => o.id !== order.id));
          setCodeInputs((current) => {
            const next = { ...current };
            delete next[order.id];
            return next;
          });
          setDeclarations((current) => {
            const next = { ...current };
            delete next[order.id];
            return next;
          });
        } finally {
          inFlightRef.current -= 1;
        }
      },
      {
        key: order.id,
        skipRefresh: true,
        // La confirmation nomme ce qui a été enregistré côté argent : c'est le
        // point sur lequel le livreur devra rendre des comptes en fin de
        // tournée.
        successMessage: !owed
          ? 'Livraison confirmée — commande déjà réglée.'
          : declared.outcome === 'full'
            ? `Livraison confirmée, ${formatMoney(order.amountDue, order.currency)} encaissés.`
            : declared.outcome === 'partial'
              ? `Livraison confirmée, paiement partiel enregistré.`
              : 'Livraison confirmée, sans paiement.',
        failureMessage: "La livraison n'a pas pu être confirmée.",
      },
    );
  }

  function setDeclaration(orderId: string, patch: Partial<Declaration>) {
    setDeclarations((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] ?? DEFAULT_DECLARATION), ...patch },
    }));
  }

  return (
    <div className="space-y-8">
      <AlertMessage message={mutation.error} />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Mes livraisons en cours</h2>
          {mine.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${sharingLocation ? 'bg-emerald-500' : 'bg-ink-faint'}`}
              />
              {sharingLocation
                ? 'Position partagée'
                : locationDenied
                  ? 'Position refusée'
                  : 'Position…'}
            </span>
          )}
        </div>
        {mine.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border p-4 text-center text-sm text-ink-faint">
            Aucune livraison en cours
          </p>
        ) : (
          <div className="space-y-3">
            {mine.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">n°{order.number}</p>
                    <p className="mt-1 text-sm text-ink-muted">{order.customerName}</p>
                    {order.deliveryAddress && (
                      <p className="mt-0.5 text-sm text-ink-muted">{order.deliveryAddress}</p>
                    )}
                  </div>
                  {/* Le montant à percevoir est la première chose que le
                      livreur doit lire : il l'annonce au client avant même de
                      sortir la commande du sac. Il est donc en gros, à part du
                      reste, et dit explicitement s'il n'y a rien à réclamer. */}
                  <div className="shrink-0 text-end">
                    {order.amountDue > 0 ? (
                      <>
                        <p className="text-xs text-ink-faint">À encaisser</p>
                        <p className="text-xl font-semibold text-ink">
                          {formatMoney(order.amountDue, order.currency)}
                        </p>
                      </>
                    ) : (
                      <Badge tone="success">Déjà payée</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {order.customerPhone && (
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-sunken"
                    >
                      Appeler
                    </a>
                  )}
                  <a
                    href={mapsUrl(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-sunken"
                  >
                    Itinéraire
                  </a>
                </div>

                {order.amountDue > 0 && (
                  <CollectionPanel
                    order={order}
                    declaration={declarations[order.id] ?? DEFAULT_DECLARATION}
                    onChange={(patch) => setDeclaration(order.id, patch)}
                  />
                )}

                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`code-${order.id}`} className="mb-1 block text-xs text-ink-faint">
                      Code de livraison (donné par le client)
                    </label>
                    <input
                      id={`code-${order.id}`}
                      inputMode="numeric"
                      maxLength={6}
                      value={codeInputs[order.id] ?? ''}
                      onChange={(event) =>
                        setCodeInputs((current) => ({ ...current, [order.id]: event.target.value }))
                      }
                      className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                  <Button
                    size="sm"
                    loading={mutation.isPending(order.id)}
                    disabled={mutation.pending || (codeInputs[order.id] ?? '').length !== 6}
                    onClick={() => confirm(order)}
                  >
                    Confirmer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Livraisons à prendre</h2>
        {pool.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border p-4 text-center text-sm text-ink-faint">
            Rien à prendre pour le moment
          </p>
        ) : (
          <div className="space-y-3">
            {pool.map((order) => (
              <Card key={order.id} className="p-4">
                <p className="font-medium">
                  n°{order.number} · {formatMoney(order.total, order.currency)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{order.customerName}</p>
                {order.deliveryAddress && (
                  <p className="mt-0.5 text-sm text-ink-muted">{order.deliveryAddress}</p>
                )}
                <Button
                  size="sm"
                  className="mt-3"
                  loading={mutation.isPending(order.id)}
                  disabled={mutation.pending}
                  onClick={() => claim(order)}
                >
                  Prendre cette livraison
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Ce que le livreur déclare avoir reçu, avant de confirmer la remise.
 *
 * Trois réponses possibles et une seule question : « le client a-t-il payé ? »
 * Le détail — montant, moyen — n'apparaît que lorsqu'il est nécessaire, pour
 * qu'un encaissement complet en espèces, qui est le cas courant, reste un
 * seul appui.
 *
 * Le livreur ne saisit jamais le montant d'un paiement complet : c'est le
 * total de la commande, affiché en clair, et le serveur l'impose de toute
 * façon.
 */
function CollectionPanel({
  order,
  declaration,
  onChange,
}: {
  order: DeliveryOrder;
  declaration: Declaration;
  onChange: (patch: Partial<Declaration>) => void;
}) {
  const choices: Array<{ value: CollectionOutcome; label: string }> = [
    { value: 'full', label: 'Payé en entier' },
    { value: 'partial', label: 'Payé en partie' },
    { value: 'none', label: 'Pas payé' },
  ];

  return (
    <div className="mt-3 rounded-xl border border-surface-border bg-surface-sunken p-3">
      <p className="text-xs font-medium text-ink">Le client a-t-il payé ?</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={declaration.outcome === choice.value}
            onClick={() => onChange({ outcome: choice.value })}
            className={cx(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              declaration.outcome === choice.value
                ? 'border-ink bg-ink text-surface'
                : 'border-surface-border bg-surface hover:border-ink',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {declaration.outcome === 'partial' && (
        <div className="mt-3">
          <Field
            label={`Montant reçu (${order.currency})`}
            htmlFor={`recu-${order.id}`}
            hint={`Sur ${formatMoney(order.amountDue, order.currency)} dus.`}
          >
            <input
              id={`recu-${order.id}`}
              inputMode="decimal"
              value={declaration.amount}
              onChange={(event) => onChange({ amount: event.target.value })}
              className={inputClass}
              placeholder="0"
            />
          </Field>
        </div>
      )}

      {declaration.outcome !== 'none' && (
        <div className="mt-3">
          <Field label="Comment" htmlFor={`moyen-${order.id}`}>
            <select
              id={`moyen-${order.id}`}
              value={declaration.method}
              onChange={(event) => onChange({ method: event.target.value })}
              className={inputClass}
            >
              {COLLECTION_METHODS.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {declaration.outcome === 'none' && (
        <p className="mt-2 text-xs text-state-warn">
          La commande restera « livrée, non payée ». Le restaurant verra le
          montant dû.
        </p>
      )}
    </div>
  );
}
