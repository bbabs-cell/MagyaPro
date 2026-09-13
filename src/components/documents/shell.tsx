import type { ReactNode } from 'react';

/**
 * Enveloppe d'un document imprimable.
 *
 * Ces pages vivent hors des tableaux de bord : elles sont faites pour
 * `window.print()` et « Enregistrer en PDF », sans barre latérale autour.
 *
 * ## Pourquoi les couleurs sont figées ici
 *
 * Un document reste blanc et sombre quel que soit le thème de l'application —
 * économie d'encre, lisibilité sur papier. Les variables `ink` et `surface`
 * sont donc épinglées sur leurs valeurs claires, ce qui permet aux documents
 * de continuer à utiliser les mêmes classes (`text-ink-muted`,
 * `border-surface-border`) que partout ailleurs, sans se soucier du thème.
 *
 * Ce bloc était recopié à l'identique dans les deux enveloppes, Restaurant et
 * Boutique. Deux copies d'une même palette finissent par diverger d'un ton, et
 * deux documents du même produit n'ont aucune raison d'être gris différemment.
 */
const DOCUMENT_THEME = {
  '--surface': '#ffffff',
  '--surface-sunken': '#f6f7f9',
  '--surface-border': '#e4e8ed',
  '--ink': '#12151a',
  '--ink-muted': '#5c6672',
  '--ink-faint': '#8b95a2',
} as const;

export function DocumentShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-surface text-ink"
      style={DOCUMENT_THEME as React.CSSProperties}
    >
      <div className="mx-auto max-w-2xl px-6 py-10 print:px-0 print:py-0">{children}</div>
    </div>
  );
}
