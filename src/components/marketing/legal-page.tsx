/**
 * Squelette commun aux trois pages légales. Le contenu réel (raison
 * sociale, adresse, numéro d'immatriculation...) n'existe pas encore : les
 * champs entre crochets sont volontairement visibles plutôt qu'inventés, et
 * seront remplacés dès que ces informations seront fournies.
 */
export function LegalPage({
  title,
  updatedLabel,
  sections,
}: {
  title: string;
  updatedLabel: string;
  sections: Array<{ heading: string; body: React.ReactNode }>;
}) {
  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          Informations légales
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-faint">{updatedLabel}</p>
      </div>

      <div className="mt-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Cette page est en cours de finalisation : les informations entre
        crochets seront complétées avec les données officielles de
        l&apos;entreprise dès qu&apos;elles seront disponibles.
      </div>

      <div className="mt-10 max-w-2xl space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
