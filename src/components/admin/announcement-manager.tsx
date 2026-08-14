'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  publishedAt: string;
  expiresAt: string | null;
};

const SEVERITY_LABELS: Record<Severity, string> = {
  INFO: 'Information',
  WARNING: 'Avertissement',
  CRITICAL: 'Critique',
};

const SEVERITY_STYLES: Record<Severity, string> = {
  INFO: 'bg-blue-500/15 text-blue-200',
  WARNING: 'bg-amber-500/15 text-amber-200',
  CRITICAL: 'bg-red-500/15 text-red-200',
};

function isActive(announcement: Announcement): boolean {
  return !announcement.expiresAt || new Date(announcement.expiresAt) > new Date();
}

export function AnnouncementManager({ initial }: { initial: Announcement[] }) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initial);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('INFO');
  const [expiresAt, setExpiresAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ announcement: Announcement }>('/api/admin/annonces', {
        title,
        body,
        severity,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setAnnouncements((current) => [result.announcement, ...current]);
      setTitle('');
      setBody('');
      setSeverity('INFO');
      setExpiresAt('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'annonce n'a pas pu être publiée.");
    } finally {
      setPending(false);
    }
  }

  async function endNow(id: string) {
    setPending(true);
    try {
      await api.patch(`/api/admin/annonces/${id}`, { end: true });
      setAnnouncements((current) =>
        current.map((a) => (a.id === id ? { ...a, expiresAt: new Date().toISOString() } : a)),
      );
    } catch {
      setError("L'annonce n'a pas pu être arrêtée.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    try {
      await api.delete(`/api/admin/annonces/${id}`);
      setAnnouncements((current) => current.filter((a) => a.id !== id));
    } catch {
      setError("L'annonce n'a pas pu être supprimée.");
    } finally {
      setPending(false);
    }
  }

  const inputStyle =
    'w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40';

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <label className="block text-sm" htmlFor="ann-title">
          Titre
          <input
            id="ann-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className={`mt-1 ${inputStyle}`}
            placeholder="Maintenance programmée"
          />
        </label>

        <label className="block text-sm" htmlFor="ann-body">
          Message
          <textarea
            id="ann-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={4}
            className={`mt-1 ${inputStyle}`}
            placeholder="Le site sera indisponible quelques minutes le..."
          />
        </label>

        <label className="block text-sm" htmlFor="ann-severity">
          Gravité
          <select
            id="ann-severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity)}
            className={`mt-1 ${inputStyle}`}
          >
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm" htmlFor="ann-expires">
          Expire le (facultatif)
          <span className="mt-1 block text-xs text-white/50">
            Videz pour un message affiché jusqu&apos;à suppression manuelle.
          </span>
          <input
            id="ann-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className={`mt-1 ${inputStyle}`}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? 'Publication…' : "Publier l'annonce"}
        </button>
      </form>

      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
        {announcements.length === 0 && (
          <li className="p-4 text-sm text-white/60">Aucune annonce publiée.</li>
        )}
        {announcements.map((announcement) => {
          const active = isActive(announcement);
          return (
            <li key={announcement.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[announcement.severity]}`}
                    >
                      {SEVERITY_LABELS[announcement.severity]}
                    </span>
                    {!active && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                        Terminée
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-medium">{announcement.title}</p>
                  <p className="mt-0.5 text-sm text-white/70">{announcement.body}</p>
                  <p className="mt-1.5 text-xs text-white/40">
                    Publiée le {new Date(announcement.publishedAt).toLocaleString('fr-FR')}
                    {announcement.expiresAt &&
                      ` · expire le ${new Date(announcement.expiresAt).toLocaleString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {active && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => endNow(announcement.id)}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
                    >
                      Arrêter maintenant
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(announcement.id)}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
