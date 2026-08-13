'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cx } from '@/components/ui';

const LINKS = [
  { href: '/admin', label: "Vue d'ensemble", exact: true },
  { href: '/admin/restaurants', label: 'Restaurants' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/abonnements', label: 'Abonnements' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/journal', label: 'Journal' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation de l'administration" className="container-page">
      <ul className="flex gap-1 overflow-x-auto pb-2">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
