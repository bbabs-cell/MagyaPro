'use client';

/**
 * Bouton d'impression. Noir par défaut, sur les reçus imprimables qui n'ont
 * pas de couleur de marque ; dans un tableau de bord, on lui passe la classe
 * d'un bouton secondaire pour ne pas ajouter une troisième couleur d'action.
 */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        'inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white print:hidden'
      }
    >
      Imprimer / Enregistrer en PDF
    </button>
  );
}
