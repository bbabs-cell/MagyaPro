'use client';

import Link from 'next/link';

import { cx } from '@/components/ui';

export type BottomNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  /** Compteur affiché sur l'icône (commandes à traiter, notifications…). */
  badge?: number;
  /** Rouge pour ce qui attend une action, neutre pour une simple nouveauté. */
  badgeTone?: 'alert' | 'neutral';
};

/**
 * Barre de navigation du bas, sur téléphone.
 *
 * Tout passait par le menu ☰ : deux gestes pour changer d'écran, des dizaines
 * de fois par jour, sur l'appareil que le produit sert en premier. La barre
 * garde à portée de pouce les quatre écrans que la personne ouvre le plus —
 * choisis par chaque tableau de bord selon ses droits — et « Plus » ouvre le
 * menu complet, qui reste la carte de tout le reste.
 *
 * Masquée dès 1024px, où la barre latérale prend le relais, et à
 * l'impression. Sa hauteur est exposée par `--bottom-nav` (voir
 * `globals.css`) pour que les barres fixées en bas d'écran — le panier de
 * la caisse — se placent au-dessus d'elle plutôt que dessous.
 */
export function BottomNav({
  items,
  onMore,
  moreOpen,
  label = 'Navigation rapide',
}: {
  items: BottomNavItem[];
  onMore: () => void;
  moreOpen: boolean;
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-bottom-nav=""
      className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <li key={item.href} className="min-w-0">
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cx(
                'relative flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors active:scale-95',
                item.active ? 'text-brand-text' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.active && (
                <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-strong" />
              )}
              <span className="relative flex h-6 w-6 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                {item.icon}
                {Boolean(item.badge) && (
                  <span
                    key={item.badge}
                    className={cx(
                      'absolute -right-2.5 -top-1.5 min-w-[1.125rem] animate-pop rounded-full px-1 text-center text-[10px] font-semibold leading-[1.125rem]',
                      item.badgeTone === 'alert'
                        ? 'bg-state-bad text-white'
                        : 'bg-brand-strong text-brand-ink',
                    )}
                  >
                    {item.badge! > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          </li>
        ))}
        <li className="min-w-0">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            className={cx(
              'flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors active:scale-95',
              moreOpen ? 'text-brand-text' : 'text-ink-muted hover:text-ink',
            )}
          >
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </span>
            Plus
          </button>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Les `limit` premiers écrans d'une liste de priorité que la personne a le
 * droit d'ouvrir — ce qu'elle ouvre le plus, selon son poste.
 */
export function pickBottomNavHrefs(priority: string[], allowed: Set<string>, limit = 4): string[] {
  return priority.filter((href) => allowed.has(href)).slice(0, limit);
}
