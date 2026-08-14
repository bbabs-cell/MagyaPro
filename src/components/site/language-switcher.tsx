'use client';

import { useRouter } from 'next/navigation';

import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS } from '@/lib/i18n/locales';
import { useI18n } from '@/components/site/i18n-provider';

/** Change la langue du site public. Un cookie suffit : pas de route par langue. */
export function LanguageSwitcher() {
  const router = useRouter();
  const { locale, dict } = useI18n();

  function change(next: string) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="sr-only">{dict.language.label}</span>
      <select
        aria-label={dict.language.label}
        value={locale}
        onChange={(event) => change(event.target.value)}
        className="rounded-lg border border-surface-border bg-white px-2 py-1 text-xs text-ink"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
