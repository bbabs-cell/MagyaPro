import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Non bundlés par Next : requis tels quels depuis node_modules, pour que
  // l'adaptateur Cloudflare d'OpenNext puisse copier le moteur WASM de
  // Prisma (query_compiler_bg.wasm) dans le bundle Worker final.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
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
