import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

import { isForeignOriginWrite, route } from '@/lib/api';

const req = (method: string, headers: Record<string, string>) =>
  new Request('https://www.magyapro.com/api/test', { method, headers });

describe("Contrôle d'origine des écritures", () => {
  it('accepte une écriture venue de la même adresse, domaine personnalisé compris', () => {
    expect(isForeignOriginWrite(req('POST', { host: 'www.magyapro.com', origin: 'https://www.magyapro.com' }))).toBe(false);
    expect(isForeignOriginWrite(req('POST', { host: 'chezawa.sn', origin: 'https://chezawa.sn' }))).toBe(false);
    // Derrière l'hébergeur, l'hôte d'origine arrive dans x-forwarded-host.
    expect(
      isForeignOriginWrite(req('PATCH', { host: 'interne', 'x-forwarded-host': 'boutique.magyapro.com', origin: 'https://boutique.magyapro.com' })),
    ).toBe(false);
  });

  it("refuse une écriture d'un autre site, même un sous-domaine voisin", () => {
    expect(isForeignOriginWrite(req('POST', { host: 'www.magyapro.com', origin: 'https://attaquant.example' }))).toBe(true);
    expect(isForeignOriginWrite(req('DELETE', { host: 'www.magyapro.com', origin: 'https://burger-lab.magyapro.com' }))).toBe(true);
    expect(isForeignOriginWrite(req('POST', { host: 'www.magyapro.com', origin: 'null' }))).toBe(true);
  });

  it("laisse passer les lectures et les appels sans Origin (webhooks, tâches planifiées)", () => {
    expect(isForeignOriginWrite(req('GET', { host: 'www.magyapro.com', origin: 'https://attaquant.example' }))).toBe(false);
    expect(isForeignOriginWrite(req('POST', { host: 'www.magyapro.com' }))).toBe(false);
  });

  it('répond 403 sans exécuter la route', async () => {
    let ran = false;
    const handler = route(async () => {
      ran = true;
      return NextResponse.json({ ok: true });
    });
    const response = await handler(req('POST', { host: 'www.magyapro.com', origin: 'https://attaquant.example' }));
    expect(response.status).toBe(403);
    expect(ran).toBe(false);
  });
});
