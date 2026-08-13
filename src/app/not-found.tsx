import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          Erreur 404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Page introuvable
        </h1>
        <p className="mx-auto mt-2 max-w-md text-ink-muted">
          Cette page n&apos;existe pas ou n&apos;est plus disponible. Le
          restaurant que vous cherchez a peut-être changé d&apos;adresse.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-ink px-6 text-sm font-medium text-white hover:bg-ink/90"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
