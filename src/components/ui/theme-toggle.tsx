/**
 * Bouton bascule thème clair/sombre — apparence neutre, réutilisée par le
 * site public, le tableau de bord restaurant et l'administration. Chaque
 * contexte gère son propre état et son propre mécanisme d'application du
 * thème (voir `chrome.tsx`, `shell.tsx`, `admin/theme-root.tsx`).
 */
export function ThemeToggle({
  theme,
  onToggle,
  className,
}: {
  theme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
      className={
        className ??
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-border text-ink-muted transition-colors hover:text-ink'
      }
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M10 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 13a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 9a1 1 0 0 1 0 2H2a1 1 0 1 1 0-2h1Zm15 0a1 1 0 0 1 0 2h-1a1 1 0 1 1 0-2h1ZM5.05 4.636a1 1 0 0 1 1.415 0l.707.707a1 1 0 1 1-1.415 1.415l-.707-.707a1 1 0 0 1 0-1.415Zm9.193 9.193a1 1 0 0 1 1.415 0l.707.707a1 1 0 1 1-1.415 1.415l-.707-.707a1 1 0 0 1 0-1.415ZM14.95 4.636a1 1 0 0 1 0 1.415l-.707.707A1 1 0 1 1 12.828 5.34l.707-.707a1 1 0 0 1 1.415 0ZM5.757 13.828a1 1 0 0 1 0 1.415l-.707.707A1 1 0 1 1 3.636 14.535l.707-.707a1 1 0 0 1 1.415 0ZM10 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M17.293 13.293a8 8 0 0 1-10.586-10.586 8.001 8.001 0 1 0 10.586 10.586Z" />
        </svg>
      )}
    </button>
  );
}
