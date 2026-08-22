import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Non bundlés par Next : requis tels quels depuis node_modules, pour que
  // l'adaptateur Cloudflare d'OpenNext puisse copier le moteur WASM de
  // Prisma (query_compiler_bg.wasm) dans le bundle Worker final.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  // Sur Vercel, le traceur de dépendances des fonctions serverless ne suit
  // pas automatiquement le moteur WASM de Prisma (chargé via un chemin de
  // fichier, pas un `require()` classique) : sans cette inclusion explicite,
  // le fichier .wasm manque au déploiement (`ENOENT ... query_compiler_bg.wasm`).
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/**/*'],
  },
  images: {
    // Uploads are served from the storage abstraction; remote drivers are
    // declared through NEXT_PUBLIC_STORAGE_HOST when a CDN is configured.
    remotePatterns: process.env.NEXT_PUBLIC_STORAGE_HOST
      ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_STORAGE_HOST }]
      : [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Complète (sans le remplacer) le réglage HSTS de la zone Cloudflare :
          // l'en-tête applicatif garantit la protection même si ce réglage
          // venait à changer côté Cloudflare. Pas de `includeSubDomains` : la
          // plateforme héberge un sous-domaine par restaurant (et des
          // domaines personnalisés), verrouiller tout le groupe d'un coup
          // pour un an n'est pas une décision à prendre sans validation
          // explicite de la couverture HTTPS de chacun.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// Ne s'exécute qu'en `next dev` local (aucun effet au build ni en
// production) : simule les bindings Cloudflare (env, ctx) pour que le code
// lisant `process.env` se comporte comme sur Workers pendant le développement.
initOpenNextCloudflareForDev();
