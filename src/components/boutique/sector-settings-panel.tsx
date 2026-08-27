'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Card, Field, cx, inputClass } from '@/components/ui';
import { SECTOR_LABELS } from '@/lib/boutique/unit-catalogue';

/**
 * Secteur d'activité et unités de la boutique.
 *
 * Le secteur ne change aucune logique de stock : il sélectionne un profil
 * (unités semées, attributs et déclinaisons suggérés). C'est ce qui fait
 * qu'une mercerie voit des mètres et des rouleaux là où une épicerie voit
 * des bouteilles et des cartons, sans que le moteur soit différent.
 */

type Unit = {
  id: string;
  code: string;
  label: string;
  labelPlural: string | null;
  isDecimal: boolean;
  isActive: boolean;
  isCustom: boolean;
  defaultFactor: number | null;
};

export function SectorSettingsPanel({
  businessType,
  units,
  canManage,
}: {
  businessType: string;
  units: Unit[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [sector, setSector] = useState(businessType);
  const [pendingSector, setPendingSector] = useState(false);
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function report(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.message : fallback);
    setSaved(null);
  }

  async function saveSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingSector(true);
    setError(null);
    setSaved(null);
    try {
      await api.patch('/api/boutique/parametres/secteur', { businessType: sector });
      setSaved('Secteur enregistré. Les unités du nouveau métier ont été ajoutées.');
      router.refresh();
    } catch (err) {
      report(err, "Le secteur n'a pas pu être enregistré.");
    } finally {
      setPendingSector(false);
    }
  }

  async function toggleUnit(unit: Unit) {
    setBusyUnitId(unit.id);
    setError(null);
    setSaved(null);
    try {
      await api.patch(`/api/boutique/unites/${unit.id}`, { isActive: !unit.isActive });
      router.refresh();
    } catch (err) {
      report(err, "L'unité n'a pas pu être modifiée.");
    } finally {
      setBusyUnitId(null);
    }
  }

  async function removeUnit(unit: Unit) {
    setBusyUnitId(unit.id);
    setError(null);
    setSaved(null);
    try {
      await api.delete(`/api/boutique/unites/${unit.id}`);
      router.refresh();
    } catch (err) {
      report(err, "L'unité n'a pas pu être supprimée.");
    } finally {
      setBusyUnitId(null);
    }
  }

  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setSaved(null);

    const formData = new FormData(event.currentTarget);
    const factor = String(formData.get('defaultFactor') ?? '').trim();

    try {
      await api.post('/api/boutique/unites', {
        label: String(formData.get('label') ?? ''),
        labelPlural: String(formData.get('labelPlural') ?? '') || undefined,
        isDecimal: formData.get('isDecimal') === 'on',
        defaultFactor: factor ? Number(factor) : null,
      });
      setShowNewUnit(false);
      setSaved('Unité créée.');
      router.refresh();
    } catch (err) {
      report(err, "L'unité n'a pas pu être créée.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Secteur et unités</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Le secteur détermine les unités proposées et les déclinaisons suggérées sur vos fiches
        produit. Il ne change rien à la façon dont votre stock est compté.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {saved}
        </div>
      )}

      <form onSubmit={saveSector} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label="Secteur d'activité" htmlFor="businessType">
            <select
              id="businessType"
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              disabled={!canManage}
              className={inputClass}
            >
              {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {canManage && sector !== businessType && (
          <Button type="submit" size="sm" loading={pendingSector}>
            Enregistrer
          </Button>
        )}
      </form>

      <div className="mt-6">
        <h3 className="text-sm font-medium">Unités disponibles</h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          Décochez celles que vous n&apos;utilisez pas : elles disparaissent des fiches produit et
          de la caisse, sans jamais effacer l&apos;historique qui les cite.
        </p>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {units.map((unit) => (
            <li
              key={unit.id}
              className={cx(
                'flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2',
                !unit.isActive && 'opacity-60',
              )}
            >
              <input
                type="checkbox"
                id={`unit-${unit.id}`}
                checked={unit.isActive}
                onChange={() => toggleUnit(unit)}
                disabled={!canManage || busyUnitId === unit.id}
                className="accent-ink"
              />
              <label htmlFor={`unit-${unit.id}`} className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-ink">{unit.label}</span>
                {unit.defaultFactor ? (
                  <span className="block text-xs text-ink-faint">
                    habituellement {unit.defaultFactor} par unité de stock
                  </span>
                ) : unit.isDecimal ? (
                  <span className="block text-xs text-ink-faint">quantité fractionnable</span>
                ) : null}
              </label>
              {unit.isCustom && canManage && (
                <button
                  type="button"
                  onClick={() => removeUnit(unit)}
                  disabled={busyUnitId === unit.id}
                  aria-label={`Supprimer ${unit.label}`}
                  className="shrink-0 text-ink-faint hover:text-red-600 disabled:opacity-40"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {canManage &&
          (showNewUnit ? (
            <form onSubmit={createUnit} className="mt-4 rounded-xl border border-surface-border p-4">
              <p className="text-sm font-medium">Nouvelle unité</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Nom (singulier)" htmlFor="label" required>
                  <input id="label" name="label" required placeholder="Plateau" className={inputClass} />
                </Field>
                <Field label="Pluriel" htmlFor="labelPlural">
                  <input id="labelPlural" name="labelPlural" placeholder="Plateaux" className={inputClass} />
                </Field>
                <Field
                  label="Contient habituellement"
                  htmlFor="defaultFactor"
                  hint="Simple suggestion : la conversion réelle se règle sur chaque fiche produit."
                >
                  <input
                    id="defaultFactor"
                    name="defaultFactor"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="30"
                    className={inputClass}
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="isDecimal" className="accent-ink" />
                Accepte les quantités à virgule (comme le kilo ou le mètre)
              </label>
              <div className="mt-4 flex gap-2">
                <Button type="submit" size="sm" loading={creating}>
                  Créer
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewUnit(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => setShowNewUnit(true)}
            >
              + Créer une unité
            </Button>
          ))}
      </div>
    </Card>
  );
}
