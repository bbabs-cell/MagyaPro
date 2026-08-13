import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

/**
 * Sitemap du domaine principal : la vitrine de Magya.
 *
 * Il ne liste pas les restaurants : chacun possède son propre domaine et son
 * propre sitemap. Les référencer ici créerait du contenu dupliqué et diluerait
 * leur référencement au profit du nôtre.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: env.appUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${env.appUrl}/inscription`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
