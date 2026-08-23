'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, uploadFile } from '@/lib/client/api';
import { Button, Card } from '@/components/ui';

type ImportResult = { updated: number; errors: Array<{ row: number; message: string }> };

/**
 * Export/import Excel du catalogue — l'export télécharge directement (simple
 * lien GET), l'import passe par ce formulaire pour afficher le rapport
 * (lignes mises à jour, lignes en erreur) une fois traité côté serveur.
 */
export function ExcelImportExport({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!(formData.get('file') instanceof File) || (formData.get('file') as File).size === 0) {
      setError('Choisissez un fichier Excel (.xlsx).');
      return;
    }

    setPending(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadFile<ImportResult>('/api/boutique/produits/import', formData);
      setResult(data);
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'import a échoué.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mb-6 p-4 sm:p-5">
      <h2 className="text-sm font-medium">Excel</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Exportez le catalogue pour le modifier hors ligne, puis réimportez-le : seuls Prix, Coût et
        Stock sont mis à jour.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href="/api/boutique/produits/export"
          className="inline-flex h-9 items-center rounded-lg border border-surface-border px-3 text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          Exporter (.xlsx)
        </a>

        {canImport && (
          <form ref={formRef} onSubmit={submit} className="flex items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".xlsx"
              required
              className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm"
            />
            <Button type="submit" size="sm" loading={pending}>
              Importer
            </Button>
          </form>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>{result.updated} article(s) mis à jour.</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-red-800">
              {result.errors.map((e) => (
                <li key={e.row}>
                  Ligne {e.row} : {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
