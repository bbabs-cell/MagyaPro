import Link from 'next/link';

/**
 * Squelette commun aux trois pages légales.
 *
 * L'état civil de l'entreprise n'existe pas encore. Les éléments manquants
 * restent donc visibles entre crochets plutôt qu'inventés : une raison sociale
 * plausible sur une page de mentions légales est une fausse déclaration, pas
 * un texte de remplissage.
 *
 * Les trois pages partagent cet en-tête, cet avertissement et cette
 * navigation. Une page légale qui ne renvoie pas aux deux autres oblige à
 * revenir au pied de page pour les trouver — et laisse croire qu'elle se
 * suffit à elle-même.
 */

const PAGES = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/conditions-generales', label: 'Conditions d’utilisation' },
  { href: '/confidentialite', label: 'Confidentialité' },
] as const;

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
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-faint">{updatedLabel}</p>
      </div>

      {/* Couleurs d'état du système, et non des teintes ambrées choisies au
          cas par cas : un avertissement se signale comme tous les autres
          avertissements du produit. */}
      <div className="mt-6 max-w-2xl rounded-xl border border-state-warn/30 bg-state-warn-soft p-4 text-sm text-state-warn">
        Ces pages sont en cours de finalisation. Les éléments entre crochets
        attendent l’état civil de l’entreprise ; ils seront complétés dès que
        ces informations seront disponibles, et ne sont volontairement pas
        remplis par des valeurs approchantes.
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

      <nav
        aria-label="Autres pages légales"
        className="mt-12 max-w-2xl border-t border-surface-border pt-6"
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {PAGES.filter((page) => page.label !== title).map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
