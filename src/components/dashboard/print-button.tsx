'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white print:hidden"
    >
      Imprimer / Enregistrer en PDF
    </button>
  );
}
