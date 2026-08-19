'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Notifications ponctuelles (toasts).
 *
 * `useToast().show(...)` depuis n'importe quel composant client sous
 * `<ToastProvider>` — pas de prop-drilling, pas de gestion d'état locale à
 * répéter dans chaque formulaire. S'ajoute au message d'erreur/succès inline
 * déjà utilisé par certains formulaires ; les deux peuvent coexister, rien
 * n'oblige à migrer l'existant d'un coup.
 */

type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-surface-border bg-surface text-ink',
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  info: 'ℹ',
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_STYLES[toast.tone]}`}
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-base leading-none">
              {TONE_ICONS[toast.tone]}
            </span>
            <p className="min-w-0 flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer"
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  }
  return context;
}
