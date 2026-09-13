'use client';

import { useEffect, useState } from 'react';

import { cx } from '@/components/ui';

/**
 * Bouton « Copier », pour les valeurs qu'on ne doit jamais retaper.
 *
 * Un jeton de vérification DNS fait une trentaine de caractères sans structure.
 * Recopié à la main dans la console d'un bureau d'enregistrement, il sera faux
 * une fois sur trois — et l'erreur ne se voit qu'après une propagation qui peut
 * durer des heures.
 *
 * Le retour est immédiat et local : le presse-papiers peut être refusé (page
 * non sécurisée, permission), auquel cas la valeur reste sélectionnable à la
 * main et le bouton le dit plutôt que de prétendre avoir réussi.
 */
export function CopyButton({
  value,
  label = 'Copier',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timeout = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timeout);
  }, [state]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState('copied');
        } catch {
          setState('failed');
        }
      }}
      className={cx(
        'shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-sunken',
        className,
      )}
    >
      {state === 'copied' ? 'Copié ✓' : state === 'failed' ? 'À copier à la main' : label}
    </button>
  );
}
