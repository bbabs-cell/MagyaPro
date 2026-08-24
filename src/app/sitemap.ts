import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

/**
 * Sitemap du domaine principal : la vitrine de Magyapro.
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
      url: `${env.appUrl}/restaurant`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${env.appUrl}/restaurant/tarifs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${env.appUrl}/inscription`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${env.appUrl}/boutique`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${env.appUrl}/boutique/tarifs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${env.appUrl}/boutique/inscription`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
