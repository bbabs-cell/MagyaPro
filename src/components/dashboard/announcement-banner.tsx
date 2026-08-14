'use client';

import { useEffect, useState } from 'react';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
};

const STYLES: Record<Announcement['severity'], string> = {
  INFO: 'bg-blue-50 text-blue-900 border-blue-200',
  WARNING: 'bg-amber-50 text-amber-900 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-900 border-red-200',
};

const DISMISSED_KEY = 'magya_dismissed_announcements';

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Annonces publiées par la plateforme, affichées en haut du dashboard.
 *
 * Le rejet est mémorisé localement (par navigateur, pas par compte) : une
 * annonce fermée ne réapparaît pas au rechargement, mais reste visible sur un
 * autre appareil — ce n'est pas un accusé de lecture, seulement un confort.
 */
export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Le stockage local peut être indisponible (navigation privée) : le
      // rejet reste effectif pour la session en cours via l'état React.
    }
  }

  return (
    <div className="space-y-2 px-4 pt-3">
      {visible.map((announcement) => (
        <div
          key={announcement.id}
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${STYLES[announcement.severity]}`}
        >
          <p>
            <span className="font-medium">{announcement.title}</span>
            <span className="ml-2">{announcement.body}</span>
          </p>
          <button
            type="button"
            onClick={() => dismiss(announcement.id)}
            aria-label="Masquer cette annonce"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
