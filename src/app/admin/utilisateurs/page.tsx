import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { UserRow } from '@/components/admin/user-row';
import { DomainHeading } from '@/components/admin/domain';

export const metadata: Metadata = { title: 'Utilisateurs' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;

  const query = (params.q ?? '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 30;

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          select: { role: true, restaurant: { select: { name: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <DomainHeading as="h1" domain="users" className="text-2xl font-semibold tracking-tight">
        Utilisateurs
      </DomainHeading>
      <p className="mt-1 text-sm text-fg/60">
        {total} compte{total > 1 ? 's' : ''} sur la plateforme.
      </p>

      <form method="get" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher un utilisateur
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Nom ou email"
          // `min-w-0` : sans lui, la largeur plancher du champ est celle de
          // son texte indicatif, et le bouton « Rechercher » sortait de
          // l'écran de 15 px à 320 px de large.
          className="min-w-0 flex-1 rounded-xl border border-fg/20 bg-fg/5 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg/45"
        />
        <button
          type="submit"
          className="h-11 rounded-xl bg-fg px-4 text-sm font-medium text-canvas hover:bg-fg/90"
        >
          Rechercher
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="table-stack table-stack-titled w-full border-collapse text-sm">
          <caption className="sr-only">Comptes utilisateurs</caption>
          <thead>
            <tr className="border-b border-fg/10 text-left text-xs uppercase tracking-wide text-fg/60">
              <th scope="col" className="py-2 pr-3 font-medium">Utilisateur</th>
              <th scope="col" className="py-2 pr-3 font-medium">Restaurants</th>
              <th scope="col" className="py-2 pr-3 font-medium">Dernière connexion</th>
              <th scope="col" className="py-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  platformRole: user.platformRole,
                  status: user.status,
                  emailVerified: user.emailVerifiedAt !== null,
                  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
                  restaurants: user.memberships.map(
                    (membership) => `${membership.restaurant.name} (${membership.role})`,
                  ),
                }}
                isSelf={user.id === admin.id}
              />
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-fg/60">
            Page {page} sur {Math.ceil(total / pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/admin/utilisateurs?q=${encodeURIComponent(query)}&page=${page - 1}`}
                className="rounded-lg border border-fg/20 px-3 py-1.5 hover:bg-fg/10"
              >
                Précédent
              </a>
            )}
            {page * pageSize < total && (
              <a
                href={`/admin/utilisateurs?q=${encodeURIComponent(query)}&page=${page + 1}`}
                className="rounded-lg border border-fg/20 px-3 py-1.5 hover:bg-fg/10"
              >
                Suivant
              </a>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
