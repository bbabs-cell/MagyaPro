/**
 * Copie le moteur de lecture de codes-barres (ZXing en WebAssembly) dans
 * `public/vendor/zxing/`, d'où le site le sert lui-même.
 *
 * Le paquet `barcode-detector` irait sinon le chercher sur un CDN tiers
 * (jsDelivr) : une dépendance réseau de plus, une adresse de visiteur
 * transmise ailleurs, et un scanner qui casse le jour où le CDN change.
 * Copié à chaque build depuis `node_modules`, le fichier suit toujours la
 * version installée ; il n'est pas versionné (`public/vendor/` est ignoré).
 *
 * Lancé par `npm run build`, `npm run dev` et `npm run cf:build`.
 */
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
// Le chemin exporté par le paquet lui-même : il suit sa structure interne.
const source = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
const target = 'public/vendor/zxing';
mkdirSync(target, { recursive: true });
copyFileSync(source, join(target, 'zxing_reader.wasm'));
console.log(`zxing_reader.wasm copié (${Math.round(statSync(source).size / 1024)} Ko)`);
