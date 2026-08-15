import Link from 'next/link';

import { Logo } from '@/components/ui/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken">
      <header className="container-page py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Logo />
        </Link>
      </header>

      <main
        id="contenu"
        className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
