import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * Sonde de santé pour l'hébergeur (Railway, load balancer, supervision).
 *
 * Vérifie une connectivité réelle à la base — un process qui répond mais dont
 * la base est injoignable n'est pas « en bonne santé », même si Next.js sert
 * la requête. Pas de cache : chaque appel reflète l'état actuel.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: 'up' });
  } catch (error) {
    console.error('[health] Base de données injoignable :', error);
    return NextResponse.json({ ok: false, database: 'down' }, { status: 503 });
  }
}
