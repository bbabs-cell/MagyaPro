'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

/**
 * Édition directe d'un restaurant de démonstration — voir
 * `/api/admin/restaurants/[id]/demo` pour pourquoi ce chemin n'existe que
 * pour les restaurants marqués `isDemo`.
 */
export function DemoRestaurantEditor({
  restaurantId,
  name,
  description,
  primaryColor,
  secondaryColor,
  templateKey,
  templates,
}: {
  restaurantId: string;
  name: string;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  templateKey: string;
  templates: Array<{ key: string; name: string }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name,
    description: description ?? '',
    primaryColor,
    secondaryColor,
    templateKey,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      await api.patch(`/api/admin/restaurants/${restaurantId}/demo`, {
        ...form,
        description: form.description.trim() || null,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="demo-name" className="block text-xs font-medium text-white/70">Nom</label>
        <input
          id="demo-name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="demo-description" className="block text-xs font-medium text-white/70">Description</label>
        <textarea
          id="demo-description"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="demo-primary" className="block text-xs font-medium text-white/70">Couleur primaire</label>
          <input
            id="demo-primary"
            type="color"
            value={form.primaryColor}
            onChange={(event) => setForm({ ...form, primaryColor: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-white/5"
          />
        </div>
        <div>
          <label htmlFor="demo-secondary" className="block text-xs font-medium text-white/70">Couleur secondaire</label>
          <input
            id="demo-secondary"
            type="color"
            value={form.secondaryColor}
            onChange={(event) => setForm({ ...form, secondaryColor: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-white/5"
          />
        </div>
      </div>

      <div>
        <label htmlFor="demo-template" className="block text-xs font-medium text-white/70">Template</label>
        <select
          id="demo-template"
          value={form.templateKey}
          onChange={(event) => setForm({ ...form, templateKey: event.target.value })}
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          {templates.map((template) => (
            <option key={template.key} value={template.key} className="text-ink">
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gradient-to-r from-[#ff9a4d] to-[#ff5e2e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-xs text-emerald-400">Enregistré.</span>}
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
