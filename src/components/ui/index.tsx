import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Primitives d'interface partagées par le dashboard, l'administration et les
 * pages d'authentification.
 *
 * Elles n'embarquent aucune logique métier : ce sont des enveloppes de style
 * et d'accessibilité. Les sites publics des restaurants ont leur propre jeu de
 * composants, pilotés par le template choisi.
 */

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

// --- Boutons ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,color,transform,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white shadow-sm shadow-brand/30 hover:brightness-110',
  secondary:
    'border border-surface-border bg-surface text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={buttonClass(variant, size, cx('active:scale-[0.98]', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// --- Formulaires -----------------------------------------------------------

export const inputClass =
  'w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {/* `role="alert"` fait annoncer l'erreur par les lecteurs d'écran dès
          qu'elle apparaît, sans que l'utilisateur ait à explorer le formulaire. */}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Structure -------------------------------------------------------------

export function Card({
  className,
  hover = false,
  children,
}: {
  className?: string;
  /** Légère élévation au survol — réservé aux cartes cliquables (liens, cartes de sélection). */
  hover?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'card',
        hover && 'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </header>
  );
}

/**
 * État vide. Toujours accompagné d'une action : une page vide sans porte de
 * sortie laisse l'utilisateur bloqué.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border bg-surface-sunken/50 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
    >
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="mt-1 text-sm text-red-800">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// --- Indicateurs -----------------------------------------------------------

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  brand: 'bg-brand-soft text-brand',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const STAT_ACCENT: Record<BadgeTone, string> = {
  neutral: 'bg-ink-faint',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  brand: 'bg-brand',
};

export function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: BadgeTone;
  /** Icône décorative affichée dans un badge coloré (tone de l'accent). */
  icon?: ReactNode;
}) {
  return (
    <div className="card relative overflow-hidden p-4 transition-shadow hover:shadow-md sm:p-5">
      <span
        aria-hidden="true"
        className={cx('absolute inset-x-0 top-0 h-1', STAT_ACCENT[tone ?? 'brand'])}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </p>
        {icon && (
          <span
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white',
              STAT_ACCENT[tone ?? 'brand'],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-ink-muted">
          {tone ? <Badge tone={tone}>{hint}</Badge> : hint}
        </p>
      )}
    </div>
  );
}

/** Indicateur de chargement, annoncé aux technologies d'assistance. */
export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-surface-border border-t-ink"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-xl bg-surface-sunken"
        />
      ))}
    </div>
  );
}
