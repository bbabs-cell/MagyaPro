'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, EmptyState, Field, inputClass } from '@/components/ui';

type TableStatus = 'FREE' | 'OCCUPIED' | 'NEEDS_CLEANING';

type Table = {
  id: string;
  label: string;
  status: TableStatus;
  publicUrl: string;
  qrDataUrl: string;
};

const STATUS_LABEL: Record<TableStatus, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Occupée',
  NEEDS_CLEANING: 'À nettoyer',
};

const STATUS_TONE: Record<TableStatus, 'success' | 'warning' | 'danger'> = {
  FREE: 'success',
  OCCUPIED: 'warning',
  NEEDS_CLEANING: 'danger',
};

const STATUS_ORDER: TableStatus[] = ['FREE', 'OCCUPIED', 'NEEDS_CLEANING'];

export function TablesManager({
  tables,
  canManage,
}: {
  tables: Table[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    try {
      await api.post('/api/tables', { label: String(formData.get('label') ?? '') });
      setCreating(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La table n'a pas pu être créée.");
    } finally {
      setPending(false);
    }
  }

  async function cycleStatus(table: Table) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(table.status) + 1) % STATUS_ORDER.length]!;
    setPendingId(table.id);
    setError(null);
    try {
      await api.patch(`/api/tables/${table.id}/statut`, { status: next });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le statut n\'a pas pu être mis à jour.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(table: Table) {
    if (!window.confirm(`Supprimer « ${table.label} » ?`)) return;
    setPendingId(table.id);
    setError(null);
    try {
      await api.delete(`/api/tables/${table.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La table n'a pas pu être supprimée.");
    } finally {
      setPendingId(null);
    }
  }

  async function copyLink(table: Table) {
    try {
      await navigator.clipboard.writeText(table.publicUrl);
      setCopiedId(table.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Presse-papiers indisponible : le lien reste affichable et sélectionnable à la main.
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {creating && canManage && (
        <Card className="mb-6 p-5">
          <h2 className="text-lg font-medium">Nouvelle table</h2>
          <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3" noValidate>
            <div className="flex-1">
              <Field label="Nom" htmlFor="label" required hint="Ex. « Table 4 » ou « Terrasse 2 »">
                <input id="label" name="label" required className={inputClass} placeholder="Table 4" />
              </Field>
            </div>
            <Button type="submit" loading={pending}>
              Créer
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Annuler
            </Button>
          </form>
        </Card>
      )}

      {tables.length === 0 ? (
        <Card className="p-4 sm:p-5">
          <EmptyState
            title="Aucune table"
            description="Créez une table pour générer son QR code : vos clients pourront appeler le serveur, demander l'addition, et commander si vous l'activez."
            action={
              canManage ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  Créer une table
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {canManage && !creating && (
            <div className="mb-4 flex justify-end">
              <Button size="sm" onClick={() => setCreating(true)}>
                Nouvelle table
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <Card key={table.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{table.label}</p>
                  <button
                    type="button"
                    disabled={pendingId === table.id}
                    onClick={() => cycleStatus(table)}
                    title="Cliquer pour changer le statut"
                  >
                    <Badge tone={STATUS_TONE[table.status]}>{STATUS_LABEL[table.status]}</Badge>
                  </button>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element -- QR généré localement en data URI */}
                <img
                  src={table.qrDataUrl}
                  alt={`QR code de ${table.label}`}
                  className="mx-auto mt-3 h-36 w-36 rounded-lg border border-surface-border"
                />

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <a
                    href={table.qrDataUrl}
                    download={`${table.label.replace(/\s+/g, '-').toLowerCase()}-qr.png`}
                    className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-sunken"
                  >
                    Télécharger
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(table)}
                    className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-sunken"
                  >
                    {copiedId === table.id ? 'Copié !' : 'Copier le lien'}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      disabled={pendingId === table.id}
                      onClick={() => remove(table)}
                      className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
