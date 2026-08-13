'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { formatMoney, toMajor, toMinor } from '@/lib/money';
import { Button, Card, EmptyState, Field, inputClass } from '@/components/ui';

type Zone = {
  id: string;
  name: string;
  fee: number;
  minOrder: number;
  freeAbove: number | null;
  isActive: boolean;
};

/**
 * Zones de livraison.
 *
 * Les frais appliqués à une commande sont ceux de la zone choisie, relus en
 * base au moment du calcul — jamais ceux affichés ici.
 */
export function DeliverySettings({
  zones,
  currency,
  deliveryEnabled,
  pickupEnabled,
}: {
  zones: Zone[];
  currency: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Zone | 'new' | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const formData = new FormData(event.currentTarget);
    const freeAboveRaw = String(formData.get('freeAbove') ?? '').trim();

    const payload = {
      name: String(formData.get('name') ?? ''),
      fee: toMinor(String(formData.get('fee') ?? '0'), currency),
      minOrder: toMinor(String(formData.get('minOrder') ?? '0'), currency),
      freeAbove: freeAboveRaw ? toMinor(freeAboveRaw, currency) : null,
      isActive: formData.get('isActive') === 'on',
    };

    setPendingId('form');
    setError(null);
    setFieldErrors({});

    try {
      if (editing === 'new') {
        await api.post('/api/livraison/zones', payload);
      } else {
        await api.patch(`/api/livraison/zones/${editing.id}`, payload);
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("La zone n'a pas pu être enregistrée.");
      }
    } finally {
      setPendingId(null);
    }
  }

  async function remove(zone: Zone) {
    if (
      !window.confirm(
        `Supprimer la zone « ${zone.name} » ? Les commandes déjà passées conservent leurs frais.`,
      )
    ) {
      return;
    }

    setPendingId(zone.id);
    setError(null);
    try {
      await api.delete(`/api/livraison/zones/${zone.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La zone n'a pas pu être supprimée.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {(!deliveryEnabled || !pickupEnabled) && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {!deliveryEnabled
            ? 'La livraison est désactivée dans vos réglages : vos zones ne sont pas proposées aux clients.'
            : 'Le retrait sur place est désactivé dans vos réglages.'}
        </Card>
      )}

      {editing ? (
        <Card className="p-5">
          <h2 className="text-lg font-medium">
            {editing === 'new' ? 'Nouvelle zone' : `Modifier « ${editing.name} »`}
          </h2>

          <form onSubmit={save} className="mt-5 space-y-4" noValidate>
            <Field label="Nom de la zone" htmlFor="name" required error={fieldErrors.name}>
              <input
                id="name"
                name="name"
                required
                defaultValue={editing === 'new' ? '' : editing.name}
                className={inputClass}
                placeholder="Centre-ville"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label={`Frais (${currency})`}
                htmlFor="fee"
                required
                error={fieldErrors.fee}
              >
                <input
                  id="fee"
                  name="fee"
                  type="number"
                  min="0"
                  step="any"
                  required
                  defaultValue={editing === 'new' ? 0 : toMajor(editing.fee, currency)}
                  className={inputClass}
                />
              </Field>

              <Field
                label={`Minimum (${currency})`}
                htmlFor="minOrder"
                hint="0 = pas de minimum"
                error={fieldErrors.minOrder}
              >
                <input
                  id="minOrder"
                  name="minOrder"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={editing === 'new' ? 0 : toMajor(editing.minOrder, currency)}
                  className={inputClass}
                />
              </Field>

              <Field
                label={`Offerte dès (${currency})`}
                htmlFor="freeAbove"
                hint="Vide = jamais offerte"
                error={fieldErrors.freeAbove}
              >
                <input
                  id="freeAbove"
                  name="freeAbove"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={
                    editing === 'new' || editing.freeAbove === null
                      ? ''
                      : toMajor(editing.freeAbove, currency)
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing === 'new' ? true : editing.isActive}
                className="h-4 w-4 accent-ink"
              />
              Zone proposée aux clients
            </label>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={pendingId === 'form'}>
                {pendingId === 'form' ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Zones de livraison</h2>
            <Button size="sm" onClick={() => setEditing('new')}>
              Nouvelle zone
            </Button>
          </div>

          {zones.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Aucune zone configurée"
                description="Sans zone, la livraison est proposée sans frais. Créez vos zones pour facturer selon la distance."
                action={
                  <Button size="sm" onClick={() => setEditing('new')}>
                    Créer une zone
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-surface-border">
              {zones.map((zone) => (
                <li key={zone.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {zone.name}
                      {!zone.isActive && (
                        <span className="ml-2 text-xs text-ink-faint">· inactive</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {zone.fee === 0 ? 'Livraison offerte' : formatMoney(zone.fee, currency)}
                      {zone.minOrder > 0 &&
                        ` · minimum ${formatMoney(zone.minOrder, currency)}`}
                      {zone.freeAbove !== null &&
                        ` · offerte dès ${formatMoney(zone.freeAbove, currency)}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(zone)}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === zone.id}
                      onClick={() => remove(zone)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
