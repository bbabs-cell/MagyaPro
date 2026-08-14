import Link from 'next/link';

/**
 * 404 des sites publics.
 *
 * Elle couvre deux cas : un restaurant qui n'existe pas ou n'est plus publié,
 * et une page inexistante dans un site publié. Le message ne distingue pas les
 * deux — dire « ce restaurant existe mais est hors ligne » renseignerait un
 * visiteur sur des données qui ne le concernent pas.
 */
export default function SiteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Page indisponible
        </h1>
        <p className="mx-auto mt-2 max-w-md text-ink-muted">
          Cette page n&apos;est pas accessible. Le restaurant est peut-être
          momentanément hors ligne, ou l&apos;adresse a changé.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-xl border border-surface-border px-6 text-sm font-medium hover:bg-surface-sunken"
        >
          Découvrir Magyapro
        </Link>
      </div>
    </div>
  );
}
