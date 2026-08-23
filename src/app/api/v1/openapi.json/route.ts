import { NextResponse } from 'next/server';

import { buildOpenApiSpec } from '@/lib/boutique/openapi';

export function GET() {
  return NextResponse.json(buildOpenApiSpec());
}
