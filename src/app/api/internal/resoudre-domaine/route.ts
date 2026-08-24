import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Résolution d'un domaine personnalisé étranger vers son produit (Restaurant
 * ou Boutique) — appelée par le middleware (`src/middleware.ts`).
 *
 * Le middleware s'exécute sur le runtime Edge et ne peut pas ouvrir de
 * connexion Postgres directement (le pilote Prisma utilisé a besoin de vrais
 * sockets TCP). Un `fetch()` vers une route Node.js classique reste
 * compatible avec l'Edge, contrairement à une connexion base de données —
 * c'est ce détour que cette route permet.
 *
 * Ne renvoie que le produit propriétaire, jamais de détail sur la boutique
 * ou le restaurant : c'est la page publique elle-même (`/r/[host]` ou
 * `/s/[host]`) qui fait la lecture complète et applique le contrôle de
 * statut (actif/suspendu).
 */
export async function GET(request: Request) {
  // Ferme l'accès public dès que le secret est configuré (voir
  // `env.internalApiSecret`) — reste ouvert tant qu'il ne l'est pas, pour ne
  // pas casser la résolution des domaines personnalisés avant que la
  // variable d'environnement ne soit définie en production.
  if (env.internalApiSecret && request.headers.get('x-internal-secret') !== env.internalApiSecret) {
    return NextResponse.json({ product: null }, { status: 401 });
  }

  const host = new URL(request.url).searchParams.get('host')?.trim().toLowerCase();
  if (!host) {
    return NextResponse.json({ product: null }, { status: 400 });
  }

  const [restaurantDomain, storeDomain] = await Promise.all([
    prisma.domain.findFirst({ where: { hostname: host, status: 'VERIFIED' }, select: { id: true } }),
    prisma.storeDomain.findFirst({ where: { hostname: host, status: 'VERIFIED' }, select: { id: true } }),
  ]);

  const product = restaurantDomain ? 'restaurant' : storeDomain ? 'store' : null;

  // La correspondance domaine → produit change rarement (ajout/vérification
  // manuels) : une brève mise en cache réduit la charge sans retarder une
  // vérification qui vient d'aboutir de façon perceptible.
  return NextResponse.json(
    { product },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
