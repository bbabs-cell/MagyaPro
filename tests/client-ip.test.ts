import { describe, expect, it } from 'vitest';

import { clientIp, clientIpSource } from '@/lib/auth/session';

const request = (values: Record<string, string>) => new Headers(values);

describe('Adresse IP du visiteur', () => {
  it('choisit la règle selon l’hébergeur', () => {
    expect(clientIpSource(undefined, true)).toBe('vercel');
    expect(clientIpSource(undefined, false)).toBe('rightmost');
    expect(clientIpSource('cloudflare', true)).toBe('cloudflare');
    expect(clientIpSource('n’importe quoi', false)).toBe('rightmost');
  });

  it('sur Vercel, ignore un X-Forwarded-For envoyé par le client', () => {
    const headers = request({ 'x-forwarded-for': '6.6.6.6, 41.82.1.2', 'x-real-ip': '41.82.1.2' });
    expect(clientIp(headers, 'vercel')).toBe('41.82.1.2');
  });

  it('derrière un proxy qui ajoute, garde l’adresse vue par ce proxy', () => {
    // Le client a envoyé « 6.6.6.6 » ; le proxy a ajouté l'adresse réelle à la fin.
    const headers = request({ 'x-forwarded-for': '6.6.6.6, 41.82.1.2' });
    expect(clientIp(headers, 'rightmost')).toBe('41.82.1.2');
    expect(clientIp(headers, 'leftmost')).toBe('6.6.6.6');
  });

  it('derrière Cloudflare, lit cf-connecting-ip', () => {
    const headers = request({ 'cf-connecting-ip': '196.200.1.1', 'x-forwarded-for': '6.6.6.6, 196.200.1.1' });
    expect(clientIp(headers, 'cloudflare')).toBe('196.200.1.1');
  });

  it('rend null sans aucune information, et borne la longueur', () => {
    expect(clientIp(request({}), 'vercel')).toBeNull();
    expect(clientIp(request({ 'x-forwarded-for': ' , ' }), 'rightmost')).toBeNull();
    expect(clientIp(request({ 'x-real-ip': 'a'.repeat(200) }), 'vercel')).toHaveLength(64);
  });
});
