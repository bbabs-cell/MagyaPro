'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locales';
import { Button, Card, cx, inputClass } from '@/components/ui';

/** Langue du site public de la boutique — voir `src/lib/i18n/boutique-site.ts`. */
export function LanguageSettingsPanel({
  language,
  canManage,
}: {
  language: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(
    (LOCALES as readonly string[]).includes(language) ? (language as Locale) : 'fr',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      await api.patch('/api/boutique/parametres/langue', { language: value });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le réglage n'a pas pu être enregistré.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Langue</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Langue du site public de votre boutique — vue par tous vos clients.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Réglage enregistré.
        </div>
      )}

      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        <label htmlFor="language" className="sr-only">
          Langue
        </label>
        <select
          id="language"
          value={value}
          onChange={(event) => setValue(event.target.value as Locale)}
          disabled={!canManage}
          className={cx(inputClass, 'max-w-48')}
        >
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </select>

        {canManage && (
          <Button type="submit" size="sm" loading={pending}>
            Enregistrer
          </Button>
        )}
      </form>
    </Card>
  );
}
