'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FulfillmentType, OrderStatus, PaymentStatus } from '@prisma/client';

import { api } from '@/lib/client/api';
import { useI18n } from '@/components/site/i18n-provider';

/**
 * Suivi de commande en temps réel.
 *
 * Le composant part des données rendues côté serveur (pas d'écran vide au
 * premier affichage), puis interroge `/api/public/commandes/[id]` à
 * intervalle régulier pour refléter les changements de statut faits par le
 * restaurant, sans que le client ait à recharger la page.
 *
 * L'interrogation s'arrête d'elle-même une fois la commande dans un état
 * terminal (`COMPLETED` ou `CANCELLED`) : rien ne sert d'interroger un état
 * qui ne bougera plus.
 */

const POLL_INTERVAL_MS = 8000;
const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];

type OrderSnapshot = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentType: FulfillmentType;
  cancelReason: string | null;
  statusUpdatedAt: string;
  deliveryCode: string | null;
  courierLat: number | null;
  courierLng: number | null;
  courierLocationUpdatedAt: string | null;
};

/** Même principe que la carte du restaurant (`app/r/[host]/page.tsx`) : un embed OpenStreetMap, gratuit et sans clé. */
function courierMapSrc(lat: number, lng: number): string {
  const delta = 0.006;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

const CODE_VISIBLE_STATUSES: OrderStatus[] = ['READY', 'OUT_FOR_DELIVERY'];

/** Étapes affichées, selon le mode de récupération. */
function stepsFor(fulfillmentType: FulfillmentType): OrderStatus[] {
  const base: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY'];
  return fulfillmentType === 'DELIVERY'
    ? [...base, 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']
    : [...base, 'COMPLETED'];
}

export function OrderStatusTracker({
  orderId,
  initial,
  reviewUrl,
}: {
  orderId: string;
  initial: OrderSnapshot;
  /** Lien vers le formulaire d'avis, fourni uniquement si l'option est active. */
  reviewUrl?: string;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [connectionError, setConnectionError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { locale, dict } = useI18n();

  useEffect(() => {
    let cancelled = false;
    // Statut le plus récemment connu, tenu à jour localement à chaque
    // réponse : c'est lui qui décide d'arrêter le sondage, jamais l'état React
    // capturé à la création de cet effet (qui resterait figé sur sa valeur
    // initiale pour toute la durée de la boucle de `setTimeout`).
    let latestStatus = initial.status;

    async function poll() {
      try {
        const data = await api.get<OrderSnapshot>(`/api/public/commandes/${orderId}`);
        if (cancelled) return;
        latestStatus = data.status;
        setSnapshot(data);
        setConnectionError(false);
      } catch {
        // Une erreur réseau ponctuelle ne doit pas casser l'affichage : on
        // garde le dernier état connu et on retentera au prochain intervalle.
        if (!cancelled) setConnectionError(true);
      }

      if (!cancelled && !TERMINAL_STATUSES.includes(latestStatus)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    if (!TERMINAL_STATUSES.includes(initial.status)) {
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId, initial.status]);

  const isLive = !TERMINAL_STATUSES.includes(snapshot.status);

  if (snapshot.status === 'CANCELLED') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="font-medium text-red-900">{dict.tracker.cancelled}</p>
        {snapshot.cancelReason && (
          <p className="mt-1 text-sm text-red-800">{snapshot.cancelReason}</p>
        )}
      </div>
    );
  }

  const steps = stepsFor(snapshot.fulfillmentType);
  const currentIndex = steps.indexOf(snapshot.status);

  return (
    <div className="rounded-2xl border border-surface-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{dict.tracker.title}</h2>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs text-ink-faint">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
            />
            {dict.tracker.live}
          </span>
        )}
      </div>

      {/* Frise de progression. `aria-current` porte l'étape active pour les
          lecteurs d'écran ; la couleur seule n'est jamais le seul signal. */}
      <ol className="mt-5 flex items-center" aria-label="Étapes de la commande">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    done || active
                      ? 'bg-ink text-surface'
                      : 'bg-surface-sunken text-ink-faint'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span
                  className={`mt-1.5 w-16 text-center text-[11px] leading-tight sm:w-20 ${
                    active ? 'font-medium text-ink' : 'text-ink-faint'
                  }`}
                >
                  {dict.orderStatus[step]}
                </span>
              </div>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`mx-1 h-0.5 flex-1 ${done ? 'bg-ink' : 'bg-surface-sunken'}`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-sm text-ink-muted">
        {dict.tracker.payment} :{' '}
        <span className="font-medium">{dict.paymentStatus[snapshot.paymentStatus]}</span>
      </p>

      {snapshot.deliveryCode && CODE_VISIBLE_STATUSES.includes(snapshot.status) && (
        <div className="mt-3 rounded-xl border border-surface-border bg-surface-sunken p-3">
          <p className="text-xs text-ink-muted">{dict.deliveryCode}</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tracking-widest">
            {snapshot.deliveryCode}
          </p>
        </div>
      )}

      {snapshot.status === 'OUT_FOR_DELIVERY' &&
        snapshot.courierLat !== null &&
        snapshot.courierLng !== null && (
          <div className="mt-3">
            <p className="text-xs text-ink-muted">{dict.tracker.courierPosition}</p>
            <div className="mt-1.5 overflow-hidden rounded-xl border border-surface-border">
              <iframe
                title={dict.tracker.courierPosition}
                src={courierMapSrc(snapshot.courierLat, snapshot.courierLng)}
                className="h-48 w-full"
                loading="lazy"
              />
            </div>
          </div>
        )}

      <p className="mt-1 text-xs text-ink-faint">
        {dict.tracker.lastUpdate} :{' '}
        {new Date(snapshot.statusUpdatedAt).toLocaleTimeString(
          locale === 'ar' ? 'ar' : locale === 'en' ? 'en-US' : 'fr-FR',
          { hour: '2-digit', minute: '2-digit' },
        )}
      </p>

      {connectionError && (
        <p role="status" className="mt-2 text-xs text-amber-700">
          Connexion instable — nouvelle tentative en cours.
        </p>
      )}

      {snapshot.status === 'COMPLETED' && reviewUrl && (
        <Link
          href={reviewUrl}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-surface-border px-4 text-sm font-medium hover:bg-surface-sunken"
        >
          {dict.tracker.leaveReview}
        </Link>
      )}
    </div>
  );
}
