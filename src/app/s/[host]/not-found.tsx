import Link from 'next/link';

/**
 * 404 du site public d'une boutique — même principe que l'équivalent
 * Restaurant : ne distingue jamais « boutique inexistante » de « boutique
 * hors ligne », pour ne renseigner personne sur des données qui ne le
 * concernent pas.
 */
export default function StoreSiteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 text-gray-900">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Page indisponible</h1>
        <p className="mx-auto mt-2 max-w-md text-gray-500">
          Cette page n&apos;est pas accessible. La boutique est peut-être
          momentanément hors ligne, ou l&apos;adresse a changé.
        </p>
        <Link
          href="https://magyapro.com"
          className="mt-6 inline-flex h-11 items-center rounded-xl border border-gray-300 px-6 text-sm font-medium hover:bg-gray-50"
        >
          Découvrir MagyaPro
        </Link>
      </div>
    </div>
  );
}
