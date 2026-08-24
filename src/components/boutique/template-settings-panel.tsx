'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Card, cx } from '@/components/ui';

type StoreTemplateOption = { key: string; name: string; description: string | null; previewImageUrl: string | null };

/** Mise en page du site public de la boutique — voir `src/components/site-store/templates`. */
export function TemplateSettingsPanel({
  templates,
  currentTemplateKey,
  canManage,
}: {
  templates: StoreTemplateOption[];
  currentTemplateKey: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentTemplateKey);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function apply(templateKey: string) {
    setSelected(templateKey);
    if (templateKey === currentTemplateKey) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/api/boutique/parametres/template', { templateKey });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le réglage n'a pas pu être enregistré.");
      setSelected(currentTemplateKey);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Mise en page du site public</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Choisissez la présentation de votre catalogue en ligne — changez d&apos;avis à tout moment,
        vos produits et vos clients ne sont jamais affectés.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Mise en page enregistrée.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {templates.map((template) => {
          const isSelected = selected === template.key;
          return (
            <button
              key={template.key}
              type="button"
              disabled={!canManage || pending}
              onClick={() => apply(template.key)}
              className={cx(
                'rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                isSelected ? 'border-brand bg-brand-soft' : 'border-surface-border hover:border-ink-faint',
              )}
            >
              {template.previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- image de plateforme, hôte de stockage arbitraire
                <img
                  src={template.previewImageUrl}
                  alt=""
                  className="mb-2 h-28 w-full rounded-lg object-cover"
                />
              ) : (
                <div aria-hidden="true" className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-surface-sunken text-xs text-ink-faint">
                  Aperçu à venir
                </div>
              )}
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {template.name}
                {isSelected && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">Actif</span>}
              </p>
              {template.description && <p className="mt-1 text-xs text-ink-muted">{template.description}</p>}
            </button>
          );
        })}
      </div>

      {!canManage && (
        <p className="mt-3 text-xs text-ink-faint">
          Seul un propriétaire ou un administrateur peut changer la mise en page.
        </p>
      )}
    </Card>
  );
}
