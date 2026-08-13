import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
