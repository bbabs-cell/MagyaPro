/**
 * Sonde de validation des téléversements.
 *
 * Envoie des fichiers dont le nom et le type annoncé mentent sur le contenu :
 * script PHP nommé `.png`, HTML nommé `.jpg`, SVG (vecteur scriptable). Seul
 * le dernier cas — un PNG authentique — doit être accepté ; il sert de
 * contrôle positif, sans lequel la sonde ne prouverait rien.
 *
 * PRÉREQUIS : voir `audit-authz.mjs`.
 * USAGE : node scripts/audit-upload.mjs
 */
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/connexion', { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'demo-la-terrasse@demo.magyapro.app');
await p.fill('input[type="password"]', 'Demo!2345');
await Promise.all([p.waitForURL(u => !u.pathname.includes('/connexion')), p.click('button[type="submit"]')]);

const cases = [
  ['script déguisé en PNG', 'evil.png', 'image/png', '<?php system($_GET["c"]); ?>'],
  ['HTML déguisé en JPEG',  'x.jpg',    'image/jpeg', '<html><script>alert(1)</script></html>'],
  ['SVG (vecteur scriptable)', 'x.svg',  'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
  ['PNG authentique',       'ok.png',   'image/png', null],
];

for (const [label, name, type, text] of cases) {
  const res = await p.evaluate(async ([name, type, text]) => {
    let bytes;
    if (text === null) {
      // Un vrai PNG 1×1, en-tête compris.
      const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    } else {
      bytes = new TextEncoder().encode(text);
    }
    const fd = new FormData();
    fd.append('file', new File([bytes], name, { type }));
    fd.append('folder', 'products');
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    return { status: r.status, body: (await r.text()).slice(0, 110).replace(/\s+/g, ' ') };
  }, [name, type, text]);
  const accepted = res.status >= 200 && res.status < 300;
  console.log(`${accepted ? '⚠ ACCEPTÉ' : '✓ refusé '} [${res.status}] ${label}`);
  if (accepted) console.log(`           → ${res.body}`);
}
await b.close();
